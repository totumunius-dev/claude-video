import { describe, expect, it } from "vitest";
import { COMMUNITY_TEMPLATE } from "../src/data/seed";
import { activateCompanion } from "../src/core/companions";
import { handleUserMessage } from "../src/core/conductor";
import { retryDelegation } from "../src/core/engine";
import { approveEmail, approveGmailAuth, beginGmailAuth, editEmail } from "../src/core/gmail";
import { buildGraph, neighbours } from "../src/core/knowledge";
import { FEEDBACK_STRATEGY_TITLE } from "../src/core/playbooks";
import { useActivity } from "../src/state/activityStore";
import { useApprovals } from "../src/state/approvalStore";
import { useCompanions } from "../src/state/companionStore";
import { useConversation } from "../src/state/conversationStore";
import { useDelegations } from "../src/state/delegationStore";
import { getIntegration } from "../src/state/integrationStore";
import { useKnowledge } from "../src/state/knowledgeStore";
import { useUI } from "../src/state/uiStore";

const coreMessages = () => useConversation.getState().messages.filter((m) => m.thread === "core");
const lastCore = () => coreMessages().at(-1)!;
const entryByTitle = (t: string) => useKnowledge.getState().entries.find((e) => e.title === t);
const activate = () => activateCompanion(structuredClone(COMMUNITY_TEMPLATE));

describe("1. team gap analysis", () => {
  it("recommends Community with a Create Companion card", async () => {
    await handleUserMessage("What is missing from my team for a product launch?");
    const m = coreMessages().find((x) => x.card?.type === "team-gap")!;
    expect(m.text).toMatch(/missing role is customer voice/);
    expect(m.card).toMatchObject({ type: "team-gap", templateId: "community" });
  });

  it("reports no gap once Community is active", async () => {
    activate();
    await handleUserMessage("What is missing from my team for a product launch?");
    expect(lastCore().text).toMatch(/Nothing essential is missing/);
  });
});

describe("2. dynamic companion creation", () => {
  it("opens the builder, then activation adds roster entry, flow, knowledge, and chat message", async () => {
    await handleUserMessage("Create that companion.");
    expect(useUI.getState().builderOpen).toBe("community");

    activate();
    const c = useCompanions.getState().companions.find((x) => x.id === "community")!;
    expect(c.status).toBe("IDLE");
    expect(useDelegations.getState().flows.some((f) => f.kind === "system" && f.title.includes("Community"))).toBe(true);
    expect(entryByTitle("Companion Profile: Community")?.folder).toBe("System");
    expect(lastCore().card?.type).toBe("companion-created");
  });
});

describe("3. Community delegation", () => {
  it("runs to COMPLETED and saves the customer voice strategy", async () => {
    activate();
    await handleUserMessage("Ask Community to create a launch-day customer feedback strategy.");
    const d = useDelegations.getState().delegations.find((x) => x.to === "community")!;
    expect(d.status).toBe("COMPLETED");
    expect(d.result?.knowledgeUsed.length).toBeGreaterThan(0);

    const e = entryByTitle(FEEDBACK_STRATEGY_TITLE)!;
    expect(e.folder).toBe("Strategy");
    expect(e.content.join(" ")).toMatch(/Personal outreach to early users/);
    expect(e.content.join(" ")).toMatch(/Weekly feedback synthesis/);
    expect(d.result?.knowledgeCreated).toContain(e.id);

    // visible in Core chat and in the Community tab
    expect(coreMessages().some((m) => m.card?.type === "result" && m.card.delegationId === d.id)).toBe(true);
    expect(useConversation.getState().messages.some((m) => m.thread === "community" && m.card?.type === "result")).toBe(true);
    expect(useCompanions.getState().companions.find((c) => c.id === "community")!.status).toBe("IDLE");
    // the full status walk appears in Live Activity
    const texts = useActivity.getState().events.map((x) => x.text);
    expect(texts.some((t) => /Core delegated to Community/.test(t))).toBe(true);
    expect(texts.some((t) => /Community completed/.test(t))).toBe(true);
  });

  it("asks for Community to be created first when it's not on the roster", async () => {
    await handleUserMessage("Ask Community to create a launch-day customer feedback strategy.");
    expect(lastCore().text).toMatch(/isn't on your team yet/);
    expect(useDelegations.getState().delegations).toHaveLength(0);
  });
});

describe("4-5. Gmail connection and email approval", () => {
  it("connects Gmail in Preview Mode", async () => {
    await handleUserMessage("Connect my Gmail.");
    expect(lastCore().card).toMatchObject({ type: "integration", integration: "gmail" });
    beginGmailAuth();
    expect(useUI.getState().gmailAuthOpen).toBe(true);
    await approveGmailAuth("you@preview.example", ["gmail.read", "gmail.compose", "gmail.send"]);
    expect(getIntegration("gmail")).toMatchObject({ status: "CONNECTED", account: "you@preview.example" });
    expect(useUI.getState().gmailAuthOpen).toBe(false);
  });

  it("drafts an email that waits for approval and becomes MOCK_SENT", async () => {
    await handleUserMessage("Email Michael about the launch momentum.");
    const a = useApprovals.getState().approvals[0];
    expect(a.status).toBe("WAITING_FOR_APPROVAL");
    expect(a.payload).toMatchObject({ to: "michael@preview.example", destination: "gmail" });

    // cannot approve while Gmail is disconnected
    expect(await approveEmail(a.id)).toBe(false);
    expect(useApprovals.getState().approvals[0].status).toBe("WAITING_FOR_APPROVAL");

    await approveGmailAuth("you@preview.example", ["gmail.send"]);
    editEmail(a.id, { subject: "Launch update" });
    expect(await approveEmail(a.id)).toBe(true);
    const done = useApprovals.getState().approvals[0];
    expect(done.status).toBe("MOCK_SENT");
    expect(done.payload.subject).toBe("Launch update");
    expect(done.history.map((h) => h.action)).toEqual(
      expect.arrayContaining(["Drafted by Core", "Edited by you", "Approved by you"]),
    );
    expect(useDelegations.getState().flows.find((f) => f.id === done.flowId)?.status).toBe("COMPLETED");
  });

  it("mentions Community in the email when it has been onboarded", async () => {
    activate();
    await handleUserMessage("Email Michael about the launch momentum and Community being onboarded.");
    expect(useApprovals.getState().approvals[0].payload.body).toMatch(/onboarded Community/);
  });
});

describe("6. parallel dispatch with partial failure", () => {
  it("runs five delegations and summarizes successes and the failure", async () => {
    activate();
    await handleUserMessage("Send a dispatch to every companion.");
    expect(coreMessages().some((m) => m.text === "Five companions are working in parallel.")).toBe(true);
    const ds = useDelegations.getState().delegations.filter((d) => d.playbook === "dispatch");
    expect(ds).toHaveLength(5);
    expect(ds.filter((d) => d.status === "COMPLETED")).toHaveLength(4);
    const failed = ds.find((d) => d.status === "FAILED")!;
    expect(failed.to).toBe("counsel");

    const summary = coreMessages().find((m) => m.card?.type === "summary")!;
    expect(summary.text).toMatch(/4 of 5 completed, 1 failed/);
    const flow = useDelegations.getState().flows.find((f) => f.kind === "dispatch")!;
    expect(flow.status).toBe("PARTIAL");

    await retryDelegation(failed.id);
    expect(useDelegations.getState().delegations.find((d) => d.id === failed.id)!.status).toBe("COMPLETED");
    expect(useDelegations.getState().flows.find((f) => f.kind === "dispatch")!.status).toBe("COMPLETED");
  });
});

describe("7. delegation chain with sub-agents", () => {
  it("runs Core -> Marketer -> Scout -> workers -> Marketer -> Core", async () => {
    await handleUserMessage("Have Marketer ask Scout to research competitors and turn it into campaign ideas.");
    const { delegations, edges, subAgents } = useDelegations.getState();
    const marketer = delegations.find((d) => d.to === "marketer")!;
    const scout = delegations.find((d) => d.to === "scout")!;
    expect(marketer.status).toBe("COMPLETED");
    expect(scout.status).toBe("COMPLETED");
    expect(scout.parentId).toBe(marketer.id);
    expect(scout.from).toBe("marketer");
    expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual(["core>marketer", "marketer>scout"]);

    expect(subAgents.map((a) => a.name).sort()).toEqual(["Competitor Scanner", "Source Validator", "Trend Researcher"]);
    expect(subAgents.every((a) => a.status === "ARCHIVED" && a.parentCompanionId === "scout" && a.result)).toBe(true);

    const research = entryByTitle("Competitor Landscape Scan - Launch Week")!;
    const ideas = entryByTitle("Competitor-Informed Campaign Ideas")!;
    expect(research.linkedEntries).toContain(ideas.id);
    expect(marketer.result?.knowledgeUsed).toContain(research.id);

    const texts = useActivity.getState().events.map((e) => e.text);
    for (const re of [/Marketer delegated to Scout/, /Scout launched 3 research workers/, /Scout returned findings to Marketer/, /Marketer drafted campaign ideas/]) {
      expect(texts.some((t) => re.test(t))).toBe(true);
    }
  });
});

describe("8. knowledge sharing", () => {
  it("Builder finds and references Community's strategy", async () => {
    activate();
    await handleUserMessage("Ask Community to create a launch-day customer feedback strategy.");
    await handleUserMessage("Ask Builder to review the Community strategy before preparing a roadmap.");
    const strategy = entryByTitle(FEEDBACK_STRATEGY_TITLE)!;
    const d = useDelegations.getState().delegations.find((x) => x.to === "builder")!;
    expect(d.result?.knowledgeUsed).toContain(strategy.id);
    expect(d.result?.bullets.join(" ")).toMatch(FEEDBACK_STRATEGY_TITLE);
    const plan = entryByTitle("Next Week Build Plan")!;
    expect(plan.folder).toBe("Product");
    expect(strategy.linkedEntries).toContain(plan.id);
  });

  it("companions only read their permitted folders", async () => {
    await handleUserMessage("Ask Scout what changed in the launch plan");
    const d = useDelegations.getState().delegations.find((x) => x.to === "scout")!;
    const folders = d.result!.knowledgeUsed.map((id) => useKnowledge.getState().entries.find((e) => e.id === id)!.folder);
    expect(folders.every((f) => ["Research", "Marketing", "Strategy"].includes(f))).toBe(true);
  });
});

describe("9-10. Brain views", () => {
  it("builds the strategy -> roadmap -> campaign -> legal graph", async () => {
    activate();
    await handleUserMessage("Ask Community to create a launch-day customer feedback strategy.");
    const strategy = entryByTitle(FEEDBACK_STRATEGY_TITLE)!;
    const g = buildGraph(useKnowledge.getState().entries);
    const has = (s: string, t: string) => g.edges.some((e) => e.source === s && e.target === t);
    expect(has(strategy.id, "kb-roadmap")).toBe(true);
    expect(has("kb-roadmap", "kb-campaign")).toBe(true);
    expect(has("kb-campaign", "kb-legal")).toBe(true);

    expect(buildGraph(useKnowledge.getState().entries, { folder: "Strategy" }).nodes.every((n) => n.folder === "Strategy")).toBe(true);
    expect(buildGraph(useKnowledge.getState().entries, { companion: "community" }).nodes.map((n) => n.id)).toContain(strategy.id);
    expect(neighbours(useKnowledge.getState().entries, "kb-roadmap").map((n) => n.id)).toEqual(
      expect.arrayContaining([strategy.id, "kb-campaign"]),
    );
  });
});

describe("11. refresh persistence", () => {
  it("writes every slice to localStorage", async () => {
    activate();
    await handleUserMessage("Ask Community to create a launch-day customer feedback strategy.");
    const read = (k: string) => JSON.parse(localStorage.getItem(`nova.deck.v1.${k}`) ?? "null")?.state;
    expect(read("companions").companions.some((c: { id: string }) => c.id === "community")).toBe(true);
    expect(read("knowledge").entries.some((e: { title: string }) => e.title === FEEDBACK_STRATEGY_TITLE)).toBe(true);
    expect(read("conversation").messages.length).toBeGreaterThan(2);
    expect(read("delegations").delegations[0].status).toBe("COMPLETED");
    expect(read("activity").events.length).toBeGreaterThan(0);
    expect(read("context").workspaceGoal).toMatch(/Nov 3/);
    expect(read("integrations").integrations).toHaveLength(4);
    expect(read("approvals").approvals).toEqual([]);
  });

  it("rehydrates stores from localStorage", async () => {
    activate();
    const saved = localStorage.getItem("nova.deck.v1.companions")!;
    useCompanions.setState({ companions: [] });
    localStorage.setItem("nova.deck.v1.companions", saved);
    await useCompanions.persist.rehydrate();
    expect(useCompanions.getState().companions.map((c) => c.id)).toContain("community");
  });
});
