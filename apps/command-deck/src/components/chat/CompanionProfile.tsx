import { useState } from "react";
import { useCompanions } from "../../state/companionStore";
import { useDelegations } from "../../state/delegationStore";
import { useKnowledge } from "../../state/knowledgeStore";
import { Avatar, Name, Status, fmtTime } from "../ui";
import { KnowledgeLink } from "./Cards";

export function CompanionProfile({ id }: { id: string }) {
  const c = useCompanions((s) => s.companions.find((x) => x.id === id));
  const delegations = useDelegations((s) => s.delegations);
  const entries = useKnowledge((s) => s.entries);
  const [open, setOpen] = useState(true);
  if (!c) return null;
  const mine = delegations.filter((d) => d.to === c.id).reverse();
  const used = Array.from(new Set(mine.flatMap((d) => d.result?.knowledgeUsed ?? []))).slice(0, 6);
  const created = entries.filter((e) => e.createdBy === c.id).map((e) => e.id).reverse().slice(0, 6);

  return (
    <div className="profile">
      <div className="idt">
        <Avatar id={c.id} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{c.name}</b> <Status value={c.status} />
          <div className="small muted">{c.role}</div>
        </div>
        <button className="btn sm ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide" : "Profile"}</button>
      </div>
      {open && (
        <dl>
          <dt>Persona</dt>
          <dd>{c.persona.voice} · {c.persona.traits.join(", ")}</dd>
          <dt>Skills</dt>
          <dd>{c.skills.map((s) => <span key={s.id} className="tag">{s.name}</span>)}</dd>
          <dt>Tools</dt>
          <dd>{c.tools.map((t) => <span key={t.id} className="tag">{t.name}</span>)}</dd>
          <dt>Reads</dt>
          <dd>{c.knowledgeFolders.map((f) => <span key={f.folder} className="tag">{f.folder}</span>)}</dd>
          <dt>Current task</dt>
          <dd>{c.currentTask ?? <span className="dim">None</span>}</dd>
          <dt>Recent</dt>
          <dd>
            {mine.length ? (
              mine.slice(0, 4).map((d) => (
                <div key={d.id} className="small">
                  <Status value={d.status} /> {d.title} <span className="dim">· from <Name id={d.from} /> · {fmtTime(d.createdAt)}</span>
                </div>
              ))
            ) : (
              <span className="dim">No delegations yet</span>
            )}
          </dd>
          <dt>Knowledge used</dt>
          <dd className="kused">{used.length ? used.map((k) => <KnowledgeLink key={k} id={k} />) : <span className="dim">None yet</span>}</dd>
          <dt>Created</dt>
          <dd className="kused">{created.length ? created.map((k) => <KnowledgeLink key={k} id={k} />) : <span className="dim">None yet</span>}</dd>
        </dl>
      )}
    </div>
  );
}
