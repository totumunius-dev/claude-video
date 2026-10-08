import { useEffect, useState } from "react";
import { approveGmailAuth, cancelGmailAuth } from "../core/gmail";
import { GMAIL_SCOPES, providers } from "../integrations/mockProviders";
import { useUI } from "../state/uiStore";
import { Icon } from "./ui";

/** Simulated OAuth consent. Clearly labelled as a preview; no real account is touched. */
export function GmailAuthModal() {
  const open = useUI((s) => s.gmailAuthOpen);
  const [step, setStep] = useState<"account" | "scopes" | "connecting">("account");
  const [accounts, setAccounts] = useState<string[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [scopes, setScopes] = useState(() => GMAIL_SCOPES.map((s) => s.id));

  useEffect(() => {
    if (!open) return;
    setStep("account");
    setAccount(null);
    setScopes(GMAIL_SCOPES.map((s) => s.id));
    void providers.gmail.listAccounts().then(setAccounts);
  }, [open]);

  if (!open) return null;
  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" style={{ width: "min(460px, 100%)" }}>
        <div className="mh">
          <h2 id="auth-title">Authorize Gmail</h2>
          <button onClick={cancelGmailAuth} aria-label="Cancel"><Icon name="close" /></button>
        </div>
        <div className="mb">
          <div className="pill preview" style={{ justifySelf: "start" }}>SIMULATED AUTHORIZATION · PREVIEW MODE</div>
          {step === "account" && (
            <>
              <div>Choose an account to continue to NOVA_OS</div>
              {accounts.map((a) => (
                <button key={a} className={`acct ${account === a ? "on" : ""}`} onClick={() => setAccount(a)} aria-pressed={account === a}>
                  <span className="av" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{a[0].toUpperCase()}</span>
                  <span>
                    <b>{a.split("@")[0]}</b>
                    <div className="small muted">{a}</div>
                  </span>
                </button>
              ))}
            </>
          )}
          {step !== "account" && (
            <>
              <div>
                NOVA_OS wants access to <b>{account}</b>
              </div>
              {GMAIL_SCOPES.map((s) => (
                <label key={s.id} className="scope">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s.id)}
                    onChange={(e) => setScopes(e.target.checked ? [...scopes, s.id] : scopes.filter((x) => x !== s.id))}
                  />
                  <span>
                    <b>{s.label}</b>
                    <div className="small muted">{s.description}</div>
                  </span>
                </label>
              ))}
              <div className="small dim">Preview Mode stores this connection only in this browser. Email is never actually sent.</div>
            </>
          )}
        </div>
        <div className="mf">
          <button className="btn ghost" onClick={cancelGmailAuth}>Cancel</button>
          {step === "account" ? (
            <button className="btn primary" disabled={!account} onClick={() => setStep("scopes")}>Continue</button>
          ) : (
            <button
              className="btn primary"
              disabled={step === "connecting" || scopes.length === 0}
              onClick={async () => {
                setStep("connecting");
                await approveGmailAuth(account!, scopes);
              }}
            >
              {step === "connecting" ? "Connecting…" : "Approve"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
