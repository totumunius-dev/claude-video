import { beginGmailAuth, disconnectGmail } from "../../core/gmail";
import { providers } from "../../integrations/mockProviders";
import { useApprovals } from "../../state/approvalStore";
import { useIntegrations } from "../../state/integrationStore";
import { Status, fmtTime } from "../ui";

export function IntegrationsView() {
  const integrations = useIntegrations((s) => s.integrations);
  const approvals = useApprovals((s) => s.approvals);
  return (
    <div className="view-scroll">
      <div className="view-head">
        <h1>Integrations</h1>
        <span className="pill preview">PREVIEW MODE · NO REAL CONNECTIONS</span>
      </div>
      <div className="grid-cards">
        {integrations.map((i) => (
          <article key={i.id} className="card section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>{i.name}</b>
              <Status value={i.status} />
            </div>
            <div className="small muted">
              {i.status === "CONNECTED" ? `Connected as ${i.account} · ${i.connectedAt ? fmtTime(i.connectedAt) : ""}` : providers[i.id].scopes.map((s) => s.label).join(" · ")}
            </div>
            {i.id === "gmail" ? (
              i.status === "CONNECTED" ? (
                <button className="btn ghost" onClick={() => void disconnectGmail()}>Disconnect</button>
              ) : (
                <button className="btn" onClick={beginGmailAuth}>Connect</button>
              )
            ) : (
              <button className="btn ghost" disabled>Coming later</button>
            )}
          </article>
        ))}
      </div>
      <div className="card section" style={{ marginTop: 16 }}>
        <h2>Approval history</h2>
        {approvals.length === 0 && <div className="dim">No approval requests yet. Try "Email Michael about the launch momentum."</div>}
        {[...approvals].reverse().map((a) => (
          <div key={a.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "grid", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>Email to {a.payload.toName}: {a.payload.subject}</span>
              <Status value={a.status} />
            </div>
            <div className="small dim">{a.history.map((h) => `${fmtTime(h.at)} ${h.action}`).join(" · ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
