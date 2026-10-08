import { useActivity } from "../state/activityStore";
import { useCompanions } from "../state/companionStore";
import { useDelegations } from "../state/delegationStore";
import { Avatar, Bar, Status, fmtTime } from "./ui";

export function ActiveFlows() {
  const flows = useDelegations((s) => s.flows);
  const delegations = useDelegations((s) => s.delegations);
  const busy = useCompanions((s) => s.companions.filter((c) => c.status === "BUSY").length);
  const doneEvents = useActivity((s) => s.events.filter((e) => e.kind === "delegation").length);
  const running = flows.filter((f) => f.status === "RUNNING" || f.status === "WAITING");
  const recent = [...flows].reverse().slice(0, 8);

  return (
    <section className="card flows" aria-label="Active Flows">
      <div className="card-h">
        <span>Active Flows</span>
        <span className="dim">{flows.length} total</span>
      </div>
      <div className="counts">
        <span className="run">Active <b>{running.length}</b></span>
        <span className="done">Done <b>{50 + doneEvents}</b></span>
      </div>
      {busy === 0 && <div className="idle-line">All companions idle</div>}
      {recent.length > 0 && (
        <ul>
          {recent.map((f) => {
            const ds = f.delegationIds.map((id) => delegations.find((d) => d.id === id)).filter((d) => !!d);
            const progress = ds.length ? ds.reduce((a, d) => a + d.progress, 0) / ds.length : f.status === "COMPLETED" ? 1 : 0;
            const people = Array.from(new Set(ds.map((d) => d.to)));
            return (
              <li key={f.id} className="flow">
                <div className="row">
                  <span className="t" title={f.title}>{f.title}</span>
                  <Status value={f.status} />
                </div>
                {f.kind !== "system" && f.kind !== "approval" && (
                  <Bar value={progress} state={f.status === "COMPLETED" ? "done" : f.status === "FAILED" ? "fail" : undefined} />
                )}
                <div className="meta">
                  <span>{f.kind}</span>·<span>{fmtTime(f.createdAt)}</span>
                  <span style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                    {people.map((p) => (
                      <Avatar key={p} id={p} size={18} />
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
