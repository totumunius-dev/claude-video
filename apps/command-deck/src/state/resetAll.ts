import { useActivity } from "./activityStore";
import { useApprovals } from "./approvalStore";
import { useCompanions } from "./companionStore";
import { useContext } from "./contextStore";
import { useConversation } from "./conversationStore";
import { useDelegations } from "./delegationStore";
import { useIntegrations } from "./integrationStore";
import { useKnowledge } from "./knowledgeStore";

/** Restore every persisted slice to its Preview seed. */
export function resetPreviewData(): void {
  useActivity.getState().reset();
  useApprovals.getState().reset();
  useCompanions.getState().reset();
  useContext.getState().reset();
  useConversation.getState().reset();
  useDelegations.getState().reset();
  useIntegrations.getState().reset();
  useKnowledge.getState().reset();
}
