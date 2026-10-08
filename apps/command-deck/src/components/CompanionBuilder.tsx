import { useState } from "react";
import { activateCompanion, saveCompanionDraft, testCompanion } from "../core/companions";
import { COMMUNITY_TEMPLATE } from "../data/seed";
import { useCompanions } from "../state/companionStore";
import { useUI } from "../state/uiStore";
import { FOLDERS, type ApprovalPolicy, type Companion, type KnowledgeFolder } from "../types/models";
import { Icon, Status } from "./ui";

function ChipList({ items, onRemove, onAdd, label }: { items: string[]; onRemove(i: number): void; onAdd(v: string): void; label: string }) {
  const [v, setV] = useState("");
  return (
    <div className="chips">
      {items.map((s, i) => (
        <span key={s} className="chip on">
          {s}
          <button type="button" aria-label={`Remove ${s}`} onClick={() => onRemove(i)}>×</button>
        </span>
      ))}
      <input
        className="inp"
        style={{ width: 160 }}
        aria-label={`Add ${label}`}
        placeholder={`+ add ${label}`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            e.preventDefault();
            onAdd(v.trim());
            setV("");
          }
        }}
      />
    </div>
  );
}

function BuilderForm({ initial, onClose }: { initial: Companion; onClose(): void }) {
  const roster = useCompanions((s) => s.companions);
  const [c, setC] = useState<Companion>(initial);
  const [test, setTest] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<Companion>) => setC((x) => ({ ...x, ...patch }));
  const toggleFolder = (f: KnowledgeFolder) =>
    set({
      knowledgeFolders: c.knowledgeFolders.some((k) => k.folder === f)
        ? c.knowledgeFolders.filter((k) => k.folder !== f)
        : [...c.knowledgeFolders, { folder: f, mode: "read-write" }],
    });
  const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-");

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="builder-title">
      <div className="mh">
        <h2 id="builder-title">Companion Builder</h2>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Status value="DRAFT" />
          <button onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </span>
      </div>
      <div className="mb">
        <div className="two">
          <div className="field">
            <label htmlFor="cb-name">Name</label>
            <input id="cb-name" className="inp" value={c.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cb-role">Role</label>
            <input id="cb-role" className="inp" value={c.role} onChange={(e) => set({ role: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="cb-purpose">Purpose</label>
          <textarea id="cb-purpose" className="inp" rows={2} value={c.purpose} onChange={(e) => set({ purpose: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="cb-persona">Persona</label>
          <input id="cb-persona" className="inp" value={c.persona.voice} onChange={(e) => set({ persona: { ...c.persona, voice: e.target.value } })} />
        </div>
        <div className="field">
          <span>Skills</span>
          <ChipList
            label="skill"
            items={c.skills.map((s) => s.name)}
            onRemove={(i) => set({ skills: c.skills.filter((_, j) => j !== i) })}
            onAdd={(v) => set({ skills: [...c.skills, { id: slug(v), name: v }] })}
          />
        </div>
        <div className="field">
          <span>Tools</span>
          <ChipList
            label="tool"
            items={c.tools.map((s) => s.name)}
            onRemove={(i) => set({ tools: c.tools.filter((_, j) => j !== i) })}
            onAdd={(v) => set({ tools: [...c.tools, { id: slug(v), name: v }] })}
          />
        </div>
        <div className="field">
          <span>Knowledge folders</span>
          <div className="chips">
            {FOLDERS.map((f) => {
              const on = c.knowledgeFolders.some((k) => k.folder === f);
              return (
                <button type="button" key={f} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleFolder(f)}>
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="cb-reports">Reports to</label>
            <select id="cb-reports" className="sel" value={c.reportsTo} onChange={(e) => set({ reportsTo: e.target.value })}>
              <option value="core">Core</option>
              {roster.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cb-policy">Approval policy</label>
            <select id="cb-policy" className="sel" value={c.approvalPolicy} onChange={(e) => set({ approvalPolicy: e.target.value as ApprovalPolicy })}>
              <option value="auto">Auto: no approval needed</option>
              <option value="ask-before-external">Ask before anything external</option>
              <option value="always-ask">Always ask</option>
            </select>
          </div>
        </div>
        <div className="field">
          <span>Can delegate to</span>
          <div className="chips">
            {roster.map((r) => {
              const on = c.canDelegateTo.includes(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  className={`chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() => set({ canDelegateTo: on ? c.canDelegateTo.filter((x) => x !== r.id) : [...c.canDelegateTo, r.id] })}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>
        {test && <div className="testout"><b>Test run · </b>{test}</div>}
        {confirming && (
          <div className="confirm" role="alertdialog" aria-label="Confirm activation">
            <div>
              Activate <b>{c.name}</b>? They join your roster, can take delegations, and can read{" "}
              {c.knowledgeFolders.map((k) => k.folder).join(", ") || "no folders"}.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn primary"
                onClick={() => {
                  activateCompanion(c);
                  onClose();
                }}
              >
                Confirm activation
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Back</button>
            </div>
          </div>
        )}
      </div>
      <div className="mf">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => setTest(testCompanion(c))}>Test Companion</button>
        <button className="btn" onClick={() => { saveCompanionDraft(c); onClose(); }}>Save Draft</button>
        <button className="btn primary" disabled={!c.name.trim() || confirming} onClick={() => setConfirming(true)}>Activate</button>
      </div>
    </div>
  );
}

export function CompanionBuilder() {
  const openId = useUI((s) => s.builderOpen);
  const close = useUI((s) => s.openBuilder);
  const draft = useCompanions((s) => s.drafts.find((d) => d.id === openId));
  if (!openId) return null;
  const initial = draft ?? (openId === COMMUNITY_TEMPLATE.id ? structuredClone(COMMUNITY_TEMPLATE) : null);
  if (!initial) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <BuilderForm key={openId} initial={initial} onClose={() => close(null)} />
    </div>
  );
}
