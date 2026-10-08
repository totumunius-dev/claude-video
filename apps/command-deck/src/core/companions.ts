import { useCompanions } from "../state/companionStore";
import { useKnowledge } from "../state/knowledgeStore";
import type { Companion } from "../types/models";
import { clock } from "./clock";
import { createFlow } from "./engine";
import { activity, log, notify, say } from "./events";
import { uid } from "./ids";

export function saveCompanionDraft(c: Companion) {
  useCompanions.getState().saveDraft({ ...c, status: "DRAFT", updatedAt: clock.now() });
  activity("core", "companion", `Saved ${c.name} as a draft`);
  say("core", "core", `Saved ${c.name} as a draft. Say "Create that companion" when you're ready to activate it.`);
}

/** Mock test run: shows how the companion would introduce itself and answer. */
export function testCompanion(c: Companion): string {
  const skill = c.skills[0]?.name.toLowerCase() ?? "its role";
  return `${c.persona.greeting} For launch day I'd start with ${skill}, read ${c.knowledgeFolders
    .map((f) => f.folder)
    .join(", ")}, and report to ${c.reportsTo === "core" ? "Core" : c.reportsTo}. Outbound actions follow the "${c.approvalPolicy}" policy.`;
}

/** Called only after the user confirms activation in the Companion Builder. */
export function activateCompanion(draft: Companion): Companion {
  const now = clock.now();
  const c: Companion = { ...draft, status: "IDLE", createdAt: now, updatedAt: now, recentActivity: [{ at: now, text: "Activated" }] };
  useCompanions.getState().add(c);
  useCompanions.getState().removeDraft(c.id);

  createFlow(`${c.name} joined the team`, "system", "COMPLETED");
  const kbId = uid("kb");
  useKnowledge.getState().add({
    id: kbId,
    title: `Companion Profile: ${c.name}`,
    summary: `${c.name} is the ${c.role}. ${c.purpose}`,
    content: [
      `Role: ${c.role}`,
      `Skills: ${c.skills.map((s) => s.name).join(", ")}`,
      `Tools: ${c.tools.map((t) => t.name).join(", ")}`,
      `Reads: ${c.knowledgeFolders.map((f) => f.folder).join(", ")}`,
      `Reports to: ${c.reportsTo === "core" ? "Core" : c.reportsTo}`,
      `Approval policy: ${c.approvalPolicy}`,
    ],
    folder: "System",
    tags: ["companion", c.id],
    createdBy: "core",
    relatedCompanions: [c.id],
    linkedEntries: ["kb-system"].filter((id) => useKnowledge.getState().entries.some((e) => e.id === id)),
    source: "Companion Builder",
    createdAt: now,
    updatedAt: now,
    status: "active",
  });
  activity("core", "companion", `${c.name} activated and added to the roster`);
  log("companions", `activated ${c.id}`);
  say("core", "core", `${c.name} is live. They can now take delegations and read ${c.knowledgeFolders.map((f) => f.folder).join(", ")}.`, {
    type: "companion-created",
    companionId: c.id,
    knowledgeId: kbId,
  });
  say(c.id, c.id, c.persona.greeting);
  notify(`${c.name} joined your team`);
  return c;
}
