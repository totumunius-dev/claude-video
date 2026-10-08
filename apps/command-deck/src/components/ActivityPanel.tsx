import { useState } from "react";
import { useActivity } from "../state/activityStore";
import { useDelegations } from "../state/delegationStore";
import { TERMINAL_STATUSES } from "../types/models";
import { Bar, Name, Status, fmtClock } from "./ui";

/** Sub-agents under a running delegation, drawn as a tree. */
export function SubAgentTree({ delegationId }: { delegationId: string }) {
  const agents = useDelegations((s) => s.subAgents.filter((a) => a.delegationId === delegationId));
  if (!agents.length) return null;
  return (
    <div>
      <div className="small muted">
        <Name id={agents[0].parentCompanionId} />
      </div>
      <ul className="tree">
        {agents.map((a) => (
          <li key={a.id} className={a.status === "ARCHIVED" ? "archived" : ""}>
            <span>{a.name}</span>
            <Status value={a.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Running() {
  const running = useDelegations((s) => s.delegations.filter((d) => !TERMINAL_STATUSES.includes(d.status) && d.status !== "DRAFT"));
  if (!running.length) return null;
  return (
    <div className="running">
      {running.map((d) => (
        <div key={d.id} className="run-item">
          <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span className="small">
              <Name id={d.from} /> → <b><Name id={d.to} /></b>
            </span>
            <Status value={d.status} />
          </div>
          <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
          <Bar value={d.progress} />
          <SubAgentTree delegationId={d.id} />
        </div>
      ))}
    </div>
  );
}

export function ActivityPanel() {
  const [tab, setTab] = useState<"live" | "log">("live");
  const events = useActivity((s) => s.events);
  const log = useActivity((s) => s.log);
  return (
    <section className="card activity" aria-label="Live Activity and Execution Log">
      <div className="card-h">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === "live"} className={tab === "live" ? "on" : ""} onClick={() => setTab("live")}>Live Activity</button>
          <button role="tab" aria-selected={tab === "log"} className={tab === "log" ? "on" : ""} onClick={() => setTab("log")}>Execution Log</button>
        </div>
        <span className="dim">{tab === "live" ? events.length : log.length}</span>
      </div>
      {tab === "live" ? (
        <>
          <Running />
          {events.length ? (
            <ul className="events">
              {events.slice(0, 80).map((e) => (
                <li key={e.id} className={`k-${e.kind}`}>
                  <time>{fmtClock(e.at).slice(0, 5)}</time>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">Activity appears here when Core or a companion starts work.</div>
          )}
        </>
      ) : log.length ? (
        <ul className="events log">
          {log.slice(0, 150).map((l) => (
            <li key={l.id} className={l.level}>
              <time>{fmtClock(l.at)}</time>
              <span className="src">{l.source}</span>
              <span>{l.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">No executions yet.</div>
      )}
    </section>
  );
}
