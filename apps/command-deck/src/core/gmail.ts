import { CONTACTS } from "../data/seed";
import { providers, GMAIL_SCOPES } from "../integrations/mockProviders";
import { useApprovals } from "../state/approvalStore";
import { getCompanion } from "../state/companionStore";
import { useDelegations } from "../state/delegationStore";
import { getIntegration, useIntegrations } from "../state/integrationStore";
import { useUI } from "../state/uiStore";
import type { ApprovalRequest, EmailDraft, Id } from "../types/models";
import { clock } from "./clock";
import { createFlow } from "./engine";
import { activity, log, notify, say } from "./events";
import { uid } from "./ids";

export function requestGmailConnection() {
  if (getIntegration("gmail").status === "CONNECTED") {
    say("core", "core", `Gmail is already connected as ${getIntegration("gmail").account} (Preview Mode).`);
    return;
  }
  say("core", "core", "Gmail needs your permission first. Nothing is sent without your approval.", {
    type: "integration",
    integration: "gmail",
    permissions: GMAIL_SCOPES.map((s) => s.label),
  });
}

export function beginGmailAuth() {
  useIntegrations.getState().update("gmail", { status: "AUTHORIZING" });
  useUI.getState().setGmailAuth(true);
  activity("user", "integration", "Opened Gmail authorization");
}

export async function approveGmailAuth(account: string, scopes: string[]) {
  const res = await providers.gmail.connect(account, scopes);
  useIntegrations.getState().update("gmail", { status: "CONNECTED", account: res.account, scopes: res.scopes, connectedAt: res.connectedAt });
  useUI.getState().setGmailAuth(false);
  useUI.getState().setThread("core");
  activity("system", "integration", `Gmail connected as ${account} (Preview Mode)`);
  log("integrations", `gmail CONNECTED ${account} scopes=${scopes.join(",")}`);
  say("core", "core", `Gmail is connected as ${account} in Preview Mode. I can draft emails for you; each one waits for your approval.`);
  notify("Gmail connected (Preview Mode)");
}

export function cancelGmailAuth() {
  useIntegrations.getState().update("gmail", { status: "DISCONNECTED" });
  useUI.getState().setGmailAuth(false);
  useUI.getState().setThread("core");
  say("core", "core", "Gmail connection cancelled. Nothing was connected.");
}

export async function disconnectGmail() {
  await providers.gmail.disconnect();
  useIntegrations.getState().update("gmail", { status: "DISCONNECTED", account: null, scopes: [], connectedAt: null });
  activity("system", "integration", "Gmail disconnected");
}

export function composeEmail(firstName: string, topic: string): EmailDraft {
  const key = firstName.toLowerCase();
  const toName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const community = getCompanion("community");
  const topicText = topic.replace(/[.?!]+$/, "");
  const lines = [
    `Hi ${toName},`,
    "",
    `Quick update on ${topicText || "the launch"}.`,
    "",
    "Launch momentum is strong: the build is green, the campaign is scheduled, and research is current.",
    community
      ? "We've also onboarded Community, a new companion focused on customer voice. They're lining up beta users for launch-day interviews and will share a weekly feedback summary."
      : "Next we're adding someone to own customer feedback during launch week.",
    "",
    "Happy to walk you through it this week.",
    "",
    "Best,",
  ];
  return {
    to: CONTACTS[key] ?? `${key}@preview.example`,
    toName,
    subject: community ? "Launch momentum + Community onboarded" : `Update: ${topicText || "launch momentum"}`,
    body: lines.join("\n"),
    destination: "gmail",
  };
}

export function draftEmail(firstName: string, topic: string): ApprovalRequest {
  const now = clock.now();
  const a: ApprovalRequest = {
    id: uid("apr"),
    kind: "email",
    status: "WAITING_FOR_APPROVAL",
    payload: composeEmail(firstName, topic),
    requestedBy: "core",
    flowId: null,
    history: [{ at: now, action: "Drafted by Core" }],
    createdAt: now,
    updatedAt: now,
  };
  a.flowId = createFlow(`Email to ${a.payload.toName}`, "approval", "WAITING").id;
  useApprovals.getState().add(a);
  activity("core", "approval", `Core drafted an email to ${a.payload.toName}. Waiting for your approval.`);
  const connected = getIntegration("gmail").status === "CONNECTED";
  say(
    "core",
    "core",
    connected
      ? `Here's the draft to ${a.payload.toName}. It won't go anywhere until you approve it.`
      : `Here's the draft to ${a.payload.toName}. Connect Gmail before approving; nothing is sent in Preview Mode.`,
    { type: "approval", approvalId: a.id },
  );
  return a;
}

const setFlow = (approvalId: Id, status: "COMPLETED" | "FAILED") => {
  const flowId = useApprovals.getState().approvals.find((a) => a.id === approvalId)?.flowId;
  if (flowId) useDelegations.getState().updateFlow(flowId, { status });
};

export function editEmail(id: Id, patch: Partial<EmailDraft>) {
  const a = useApprovals.getState().approvals.find((x) => x.id === id);
  if (!a || a.status !== "WAITING_FOR_APPROVAL") return;
  useApprovals.getState().update(id, { payload: { ...a.payload, ...patch } }, "Edited by you");
}

export async function approveEmail(id: Id): Promise<boolean> {
  const a = useApprovals.getState().approvals.find((x) => x.id === id);
  if (!a || a.status !== "WAITING_FOR_APPROVAL") return false;
  if (getIntegration("gmail").status !== "CONNECTED") {
    notify("Connect Gmail before approving this email", "warn");
    requestGmailConnection();
    return false;
  }
  useApprovals.getState().update(id, { status: "APPROVED" }, "Approved by you");
  const res = await providers.gmail.perform("send_email", { ...a.payload });
  useApprovals.getState().update(id, { status: "MOCK_SENT" }, `Mock sent via Gmail (${res.detail})`);
  setFlow(id, "COMPLETED");
  activity("core", "approval", `Email to ${a.payload.toName} marked MOCK SENT. Nothing was delivered.`);
  log("gmail", `approval ${id} -> MOCK_SENT to ${a.payload.to}`);
  say("core", "core", `Approved. The email to ${a.payload.toName} is marked MOCK SENT. Preview Mode doesn't deliver real email.`);
  notify(`Email to ${a.payload.toName}: MOCK SENT`);
  return true;
}

export function rejectEmail(id: Id) {
  useApprovals.getState().update(id, { status: "REJECTED" }, "Rejected by you");
  setFlow(id, "FAILED");
  activity("user", "approval", "Email draft rejected");
  say("core", "core", "Rejected. I won't send that email. Tell me what to change and I'll redraft it.");
}

export function cancelEmail(id: Id) {
  useApprovals.getState().update(id, { status: "CANCELLED" }, "Cancelled by you");
  setFlow(id, "FAILED");
  activity("user", "approval", "Email draft cancelled");
}
