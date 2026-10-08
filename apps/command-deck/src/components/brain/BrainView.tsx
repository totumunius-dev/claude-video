import { useMemo } from "react";
import { exportBrain } from "../../core/exportBrain";
import type { GraphFilter } from "../../core/knowledge";
import { useCompanions } from "../../state/companionStore";
import { useKnowledge } from "../../state/knowledgeStore";
import { useUI } from "../../state/uiStore";
import { FOLDERS, type KnowledgeEntry, type KnowledgeFolder } from "../../types/models";
import { Name, fmtDate } from "../ui";
import { GraphView } from "./GraphView";

export function EntryCard({ e }: { e: KnowledgeEntry }) {
  const open = useUI((s) => s.openEntry);
  return (
    <button className="entry" onClick={() => open(e.id)}>
      <h3>{e.title}</h3>
      <p>{e.summary}</p>
      <div className="meta">
        <span>by <Name id={e.createdBy} /></span>
        <span>{fmtDate(e.updatedAt)}</span>
        <span>{e.folder}</span>
        {e.relatedCompanions.length > 0 && (
          <span>
            with {e.relatedCompanions.map((c, i) => <span key={c}>{i ? ", " : ""}<Name id={c} /></span>)}
          </span>
        )}
      </div>
      <div>{e.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
    </button>
  );
}

export function BrainView() {
  const entries = useKnowledge((s) => s.entries.filter((e) => e.status !== "archived"));
  const companions = useCompanions((s) => s.companions);
  const mode = useUI((s) => s.brainMode);
  const setMode = useUI((s) => s.setBrainMode);
  const folder = useUI((s) => s.brainFolder) as KnowledgeFolder | null;
  const openFolder = useUI((s) => s.openFolder);
  const companionFilter = useUI((s) => s.brainCompanion);
  const setCompanionFilter = useUI((s) => s.setBrainCompanion);
  const filter = useMemo<GraphFilter>(() => ({ folder, companion: companionFilter }), [folder, companionFilter]);

  const shown = entries
    .filter((e) => !folder || e.folder === folder)
    .filter((e) => !companionFilter || e.createdBy === companionFilter || e.relatedCompanions.includes(companionFilter))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="view-scroll" style={mode === "graph" ? { display: "flex", flexDirection: "column", overflow: "hidden" } : undefined}>
      <div className="view-head">
        <h1>Brain</h1>
        <div className="tools">
          <div className="seg" role="tablist" aria-label="Brain view mode">
            <button role="tab" aria-selected={mode === "folders"} className={mode === "folders" ? "on" : ""} onClick={() => setMode("folders")}>Folder View</button>
            <button role="tab" aria-selected={mode === "graph"} className={mode === "graph" ? "on" : ""} onClick={() => setMode("graph")}>Graph View</button>
          </div>
          <select className="sel" aria-label="Filter by folder" value={folder ?? ""} onChange={(e) => openFolder(e.target.value || null)}>
            <option value="">All folders</option>
            {FOLDERS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="sel" aria-label="Filter by companion" value={companionFilter ?? ""} onChange={(e) => setCompanionFilter(e.target.value || null)}>
            <option value="">All companions</option>
            <option value="core">Core</option>
            {companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn sm" onClick={exportBrain}>Export Brain</button>
        </div>
      </div>

      {mode === "graph" ? (
        <GraphView filter={filter} />
      ) : (
        <>
          <div className="folders">
            {FOLDERS.map((f) => {
              const n = entries.filter((e) => e.folder === f).length;
              return (
                <button key={f} className={`folder ${folder === f ? "on" : ""}`} onClick={() => openFolder(folder === f ? null : f)} aria-pressed={folder === f}>
                  <b>{f}</b>
                  <span className="muted small">{n} {n === 1 ? "entry" : "entries"}</span>
                </button>
              );
            })}
          </div>
          <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {shown.map((e) => <EntryCard key={e.id} e={e} />)}
          </div>
          {shown.length === 0 && <div className="empty">No entries in {folder ?? "this filter"} yet.</div>}
        </>
      )}
    </div>
  );
}
