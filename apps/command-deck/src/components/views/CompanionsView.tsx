import { COMMUNITY_TEMPLATE } from "../../data/seed";
import { useCompanions } from "../../state/companionStore";
import { useDelegations } from "../../state/delegationStore";
import { useKnowledge } from "../../state/knowledgeStore";
import { useUI } from "../../state/uiStore";
import { Avatar, Name, Status, fmtTime } from "../ui";

export function CompanionsView() {
  const companions = useCompanions((s) => s.companions);
  const drafts = useCompanions((s) => s.drafts);
  const delegations = useDelegations((s) => s.delegations);
  const entries = useKnowledge((s) => s.entries);
  const setThread = useUI((s) => s.setThread);
  const openBuilder = useUI((s) => s.openBuilder);
  const hasCommunity = companions.some((c) => c.id === COMMUNITY_TEMPLATE.id);

  return (
    <div className="view-scroll">
      <div className="view-head">
        <h1>Companions</h1>
        <div className="tools">
          {!hasCommunity && <button className="btn" onClick={() => openBuilder(COMMUNITY_TEMPLATE.id)}>+ Companion Builder</button>}
        </div>
      </div>
      <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {[...companions, ...drafts].map((c) => {
          const mine = delegations.filter((d) => d.to === c.id);
          const done = mine.filter((d) => d.status === "COMPLETED").length;
          const created = entries.filter((e) => e.createdBy === c.id).length;
          return (
            <article key={c.id} className="card section">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar id={c.id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{c.name}</b>
                  <div className="small muted">{c.role}</div>
                </div>
                <Status value={c.status} />
              </div>
              <div className="muted">{c.description}</div>
              <div className="small"><span className="dim">Persona · </span>{c.persona.voice}</div>
              <div>{c.skills.map((s) => <span key={s.id} className="tag">{s.name}</span>)}</div>
              <div className="small"><span className="dim">Tools · </span>{c.tools.map((t) => t.name).join(", ")}</div>
              <div className="small"><span className="dim">Reads · </span>{c.knowledgeFolders.map((f) => f.folder).join(", ")}</div>
              <div className="small">
                <span className="dim">Reports to · </span><Name id={c.reportsTo} />
                {c.canDelegateTo.length > 0 && <><span className="dim"> · delegates to </span>{c.canDelegateTo.map((d, i) => <span key={d}>{i ? ", " : ""}<Name id={d} /></span>)}</>}
              </div>
              <div className="small"><span className="dim">Approval · </span>{c.approvalPolicy}</div>
              <div className="small"><span className="dim">Current · </span>{c.currentTask ?? "Idle"}</div>
              <div className="small dim">
                {done} completed · {created} Brain entries · last run {c.lastRun ? fmtTime(c.lastRun) : "never"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {c.status === "DRAFT" ? (
                  <button className="btn" onClick={() => openBuilder(c.id)}>Finish draft</button>
                ) : (
                  <button className="btn" onClick={() => setThread(c.id)}>Open chat</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
