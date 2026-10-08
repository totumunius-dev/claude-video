import { useApprovals } from "../state/approvalStore";
import { useCompanions } from "../state/companionStore";
import { useContext } from "../state/contextStore";
import { useDelegations } from "../state/delegationStore";
import { useIntegrations } from "../state/integrationStore";
import { useKnowledge } from "../state/knowledgeStore";

export function brainSnapshot() {
  return {
    exportedAt: new Date().toISOString(),
    previewMode: true,
    workspaceGoal: useContext.getState().workspaceGoal,
    memory: useContext.getState().memory,
    companions: useCompanions.getState().companions,
    knowledge: useKnowledge.getState().entries,
    delegations: useDelegations.getState().delegations,
    edges: useDelegations.getState().edges,
    integrations: useIntegrations.getState().integrations,
    approvals: useApprovals.getState().approvals,
  };
}

/** Downloads the Brain and workspace context as JSON. */
export function exportBrain() {
  const blob = new Blob([JSON.stringify(brainSnapshot(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nova-brain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
