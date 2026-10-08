import { useState } from "react";
import { cancelDelegation, retryDelegation } from "../../core/engine";
import { approveEmail, beginGmailAuth, cancelEmail, editEmail, rejectEmail } from "../../core/gmail";
import { say } from "../../core/events";
import { useApprovals } from "../../state/approvalStore";
import { useCompanions } from "../../state/companionStore";
import { useDelegations } from "../../state/delegationStore";
import { useIntegrations } from "../../state/integrationStore";
import { useKnowledge } from "../../state/knowledgeStore";
import { useUI } from "../../state/uiStore";
import { TERMINAL_STATUSES, type Id, type MessageCard } from "../../types/models";
import { SubAgentTree } from "../ActivityPanel";
import { Bar, Name, Status } from "../ui";

export function KnowledgeLink({ id }: { id: Id }) {
  const entry = useKnowledge((s) => s.entries.find((e) => e.id === id));
  const open = useUI((s) => s.openEntry);
  if (!entry) return <span className="dim small">(entry removed)</span>;
  return (
    <button className="link" onClick={() => open(id)} title={`${entry.folder} · open in Brain`}>
      ⧉ {entry.title}
    </button>
  );
}

function PlanCard({ steps }: { steps: string[] }) {
  return (
    <div className="ccard">
      <div className="h">Task plan</div>
      <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  );
}

export function DelegationCard({ id, compact }: { id: Id; compact?: boolean }) {
  const d = useDelegations((s) => s.delegations.find((x) => x.id === id));
  if (!d) return null;
  const live = !TERMINAL_STATUSES.includes(d.status);
  return (
    <div className="dl">
      <div className="route">
        <Name id={d.from} /> → <b style={{ color: "var(--fg)" }}><Name id={d.to} /></b>
        <span style={{ marginLeft: "auto" }}><Status value={d.status} /></span>
      </div>
      <div>{d.title}</div>
      <Bar value={d.progress} state={d.status === "COMPLETED" ? "done" : d.status === "FAILED" ? "fail" : undefined} />
      {!compact && (
        <ul className="steps">
          {d.steps.map((s) => (
            <li key={s.id} className={s.status}>
              <span>{s.status === "done" ? "✓" : s.status === "running" ? "›" : s.status === "failed" ? "✕" : "·"}</span>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <SubAgentTree delegationId={d.id} />
      {d.error && <div className="small" style={{ color: "var(--red)" }}>{d.error}</div>}
      <div className="actions">
        {live && <button className="btn sm ghost" onClick={() => cancelDelegation(d.id)}>Cancel</button>}
        {d.status === "FAILED" && <button className="btn sm" onClick={() => void retryDelegation(d.id)}>Retry</button>}
      </div>
    </div>
  );
}

function DelegationsCard({ ids }: { ids: Id[] }) {
  return (
    <div className="ccard">
      <div className="h">
        <span>Delegation{ids.length > 1 ? "s" : ""}</span>
        <span>{ids.length > 1 ? `${ids.length} in parallel` : ""}</span>
      </div>
      {ids.map((id) => <DelegationCard key={id} id={id} compact={ids.length > 1} />)}
    </div>
  );
}

export function ResultCard({ id }: { id: Id }) {
  const d = useDelegations((s) => s.delegations.find((x) => x.id === id));
  if (!d) return null;
  if (d.status === "FAILED" && !d.result) return <DelegationsCard ids={[id]} />;
  if (!d.result) return null;
  return (
    <div className="ccard">
      <div className="h">
        <span>Result · <Name id={d.to} /></span>
        <Status value={d.status} />
      </div>
      <div>{d.result.summary}</div>
      {d.result.bullets.length > 0 && <ul>{d.result.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
      {d.result.knowledgeUsed.length > 0 && (
        <div>
          <div className="h" style={{ marginBottom: 4 }}>Knowledge used</div>
          <div className="kused">{d.result.knowledgeUsed.map((k) => <KnowledgeLink key={k} id={k} />)}</div>
        </div>
      )}
      {d.result.knowledgeCreated.length > 0 && (
        <div>
          <div className="h" style={{ marginBottom: 4 }}>Saved to Brain</div>
          <div className="kused">{d.result.knowledgeCreated.map((k) => <KnowledgeLink key={k} id={k} />)}</div>
        </div>
      )}
    </div>
  );
}

function TeamGapCard({ card }: { card: Extract<MessageCard, { type: "team-gap" }> }) {
  const openBuilder = useUI((s) => s.openBuilder);
  const exists = useCompanions((s) => s.companions.some((c) => c.id === card.templateId));
  return (
    <div className="ccard">
      <div className="h">Team gap analysis</div>
      <div className="chips">
        {card.covered.map((c) => <span key={c} className="chip">✓ {c}</span>)}
        <span className="chip on">+ {card.missing}</span>
      </div>
      <ul className="muted">{card.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      <div className="actions">
        <button className="btn primary" disabled={exists} onClick={() => openBuilder(card.templateId)}>
          {exists ? "Companion created" : "Create Companion"}
        </button>
      </div>
    </div>
  );
}

function CompanionCreatedCard({ card }: { card: Extract<MessageCard, { type: "companion-created" }> }) {
  const setThread = useUI((s) => s.setThread);
  return (
    <div className="ccard">
      <div className="h"><span>Companion activated</span><Status value="IDLE" label="ACTIVE" /></div>
      <div className="actions">
        <button className="btn sm" onClick={() => setThread(card.companionId)}>Open <Name id={card.companionId} /></button>
        <KnowledgeLink id={card.knowledgeId} />
      </div>
    </div>
  );
}

function IntegrationCard({ card }: { card: Extract<MessageCard, { type: "integration" }> }) {
  const gmail = useIntegrations((s) => s.integrations.find((i) => i.id === card.integration)!);
  const [dismissed, setDismissed] = useState(false);
  return (
    <div className="ccard">
      <div className="h">
        <span>{gmail.name} · Preview Mode</span>
        <Status value={dismissed && gmail.status !== "CONNECTED" ? "CANCELLED" : gmail.status} />
      </div>
      <div className="muted">Requested permissions</div>
      <ul>{card.permissions.map((p) => <li key={p}>{p}</li>)}</ul>
      {gmail.status === "CONNECTED" ? (
        <div className="small" style={{ color: "var(--ok)" }}>Connected as {gmail.account}</div>
      ) : (
        !dismissed && (
          <div className="actions">
            <button className="btn primary" onClick={beginGmailAuth}>Connect</button>
            <button
              className="btn ghost"
              onClick={() => {
                setDismissed(true);
                say("core", "core", "OK, I won't connect Gmail.");
              }}
            >
              Cancel
            </button>
          </div>
        )
      )}
    </div>
  );
}

function ApprovalCard({ id }: { id: Id }) {
  const a = useApprovals((s) => s.approvals.find((x) => x.id === id));
  const connected = useIntegrations((s) => s.integrations.find((i) => i.id === "gmail")?.status === "CONNECTED");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  const waiting = a.status === "WAITING_FOR_APPROVAL";
  return (
    <div className="ccard">
      <div className="h">
        <span>Email draft · needs approval</span>
        <Status value={a.status} />
      </div>
      {editing ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input className="inp" aria-label="Recipient" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          <input className="inp" aria-label="Subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          <textarea className="inp" aria-label="Body" rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="actions">
            <button className="btn primary" onClick={() => { editEmail(a.id, draft); setEditing(false); }}>Save changes</button>
            <button className="btn ghost" onClick={() => setEditing(false)}>Discard</button>
          </div>
        </div>
      ) : (
        <>
          <div className="kv">
            <span>To</span><span>{a.payload.toName} &lt;{a.payload.to}&gt;</span>
            <span>Subject</span><span>{a.payload.subject}</span>
            <span>Via</span><span>Gmail {connected ? "" : "(not connected)"} · Preview Mode</span>
          </div>
          <div className="bodytext">{a.payload.body}</div>
        </>
      )}
      {waiting && !editing && (
        <div className="actions">
          <button className="btn" onClick={() => { setDraft({ to: a.payload.to, subject: a.payload.subject, body: a.payload.body }); setEditing(true); }}>Edit</button>
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await approveEmail(a.id); setBusy(false); }}>
            {busy ? "Sending…" : "Approve"}
          </button>
          <button className="btn danger" onClick={() => rejectEmail(a.id)}>Reject</button>
          <button className="btn ghost" onClick={() => cancelEmail(a.id)}>Cancel</button>
          {!connected && <button className="btn sm" onClick={beginGmailAuth}>Connect Gmail</button>}
        </div>
      )}
      {a.status === "MOCK_SENT" && <div className="small" style={{ color: "var(--ok)" }}>MOCK SENT. Nothing was delivered.</div>}
    </div>
  );
}

function SummaryCard({ card }: { card: Extract<MessageCard, { type: "summary" }> }) {
  const delegations = useDelegations((s) => s.delegations.filter((d) => d.flowId === card.flowId));
  return (
    <div className="ccard">
      <div className="h">Combined summary</div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {card.lines.map((l) => {
          const d = delegations.find((x) => x.to === l.companionId);
          const ok = d ? d.status === "COMPLETED" : l.ok;
          return (
            <li key={l.companionId} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: ok ? "var(--ok)" : "var(--red)" }}>{ok ? "✓" : "✕"}</span>
              <span><b><Name id={l.companionId} /></b>: {ok && d?.result ? d.result.summary : l.text}</span>
              {!ok && d && d.status === "FAILED" && (
                <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => void retryDelegation(d.id)}>Retry</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CardView({ card }: { card: MessageCard }) {
  switch (card.type) {
    case "plan": return <PlanCard steps={card.steps} />;
    case "delegation": return <DelegationsCard ids={card.delegationIds} />;
    case "team-gap": return <TeamGapCard card={card} />;
    case "companion-created": return <CompanionCreatedCard card={card} />;
    case "result": return <ResultCard id={card.delegationId} />;
    case "integration": return <IntegrationCard card={card} />;
    case "approval": return <ApprovalCard id={card.approvalId} />;
    case "summary": return <SummaryCard card={card} />;
    case "knowledge-links":
      return <div className="ccard kused">{card.entryIds.map((id) => <KnowledgeLink key={id} id={id} />)}</div>;
  }
}
