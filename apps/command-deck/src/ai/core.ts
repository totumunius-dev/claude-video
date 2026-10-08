import { COMMUNITY_TEMPLATE } from "../data/seed";
import { useActivity } from "../state/activityStore";
import { getCompanion, useCompanions } from "../state/companionStore";
import { useContext } from "../state/contextStore";
import { useConversation } from "../state/conversationStore";
import { useDelegations } from "../state/delegationStore";
import { useIntegrations } from "../state/integrationStore";
import { useKnowledge } from "../state/knowledgeStore";
import { useUI } from "../state/uiStore";
import { TERMINAL_STATUSES, type ChatMessage } from "../types/models";
import { clock } from "../core/clock";
import { delegateOne, dispatchAll, runCampaignChain } from "../core/engine";
import { draftEmail, requestGmailConnection } from "../core/gmail";
import { uid } from "../core/ids";
import { choosePlaybook } from "../core/intents";
import { DISPATCH_DURATIONS, DISPATCH_TASKS } from "../core/playbooks";
import { analyzeTeam } from "../core/teamAnalysis";
import type { AIProvider, AITool, AITurn } from "./provider";

const PREVIEW_FAILURES = { counsel: "Policy library is unavailable in Preview Mode" };

/** Everything Core knows right now, as compact text for the prompt. */
export function workspaceContext(): string {
  const companions = useCompanions.getState().companions;
  const entries = useKnowledge.getState().entries.filter((e) => e.status !== "archived");
  const open = useDelegations.getState().delegations.filter((d) => !TERMINAL_STATUSES.includes(d.status));
  const gmail = useIntegrations.getState().integrations.find((i) => i.id === "gmail")!;
  const ctx = useContext.getState();
  const recent = useActivity.getState().events.slice(0, 8).map((e) => `- ${e.text}`);
  return [
    `Workspace goal: ${ctx.workspaceGoal}`,
    `Remembered about the user:\n${ctx.memory.filter((m) => m.kind !== "goal").map((m) => `- ${m.text}`).join("\n") || "- nothing yet"}`,
    `Companions on the team:\n${companions
      .map((c) => `- ${c.name} (${c.role}; skills: ${c.skills.map((s) => s.name).join(", ")}; reads ${c.knowledgeFolders.map((f) => f.folder).join("/")}; ${c.status}${c.currentTask ? `, working on "${c.currentTask}"` : ""})`)
      .join("\n")}`,
    getCompanion(COMMUNITY_TEMPLATE.id) ? "" : "Not yet on the team: Community (customer voice: beta feedback, user interviews). It can be created with open_companion_builder.",
    `Open delegations: ${open.length ? open.map((d) => `${d.title} -> ${d.to} (${d.status})`).join("; ") : "none"}`,
    `Gmail: ${gmail.status}${gmail.account ? ` as ${gmail.account}` : ""} (Preview Mode: email is never really sent)`,
    `Brain entries (${entries.length}):\n${entries.map((e) => `- [${e.folder}] ${e.title}: ${e.summary}`).join("\n")}`,
    `Recent activity:\n${recent.join("\n") || "- none"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const RULES = `You are Core, the conductor of NOVA_OS, a voice-first command center. The user talks to you by voice and your reply is read aloud.

How to reply:
- 1 to 3 short spoken sentences. Plain words, no markdown, no lists, no emoji.
- Warm, direct, a little upbeat. Use the user's context below.
- When the user asks for work, USE A TOOL to do it, then say what you started. Never claim something is done unless a tool did it. Delegated work finishes later; say who is on it.
- Pick the companion whose skills fit. Only delegate to companions on the team.
- Emails are drafts that wait for the user's approval. Never say an email was sent.
- If nothing needs doing, just talk.
- This is Preview Mode with mock data: no real services are connected.`;

/** The page functions Core may call. Each one starts the real app action and returns a short note. */
export function coreTools(background: Promise<unknown>[]): AITool[] {
  const run = (p: Promise<unknown>) => {
    background.push(p);
  };
  const name = (x: unknown) => String(x ?? "").trim().toLowerCase();
  return [
    {
      name: "review_team",
      description: "Compare the companion roster with the workspace goal and show the user a team gap card. Returns what is covered and what is missing.",
      execute() {
        const a = analyzeTeam(useCompanions.getState().companions, useContext.getState().workspaceGoal);
        if (a.missing) {
          useConversation.getState().add({
            id: uid("msg"),
            thread: "core",
            author: "core",
            text: `Covered: ${a.covered.join(", ")}. Missing: ${a.missing.area}.`,
            card: { type: "team-gap", covered: a.covered, missing: a.missing.area, facts: a.facts, templateId: a.missing.templateId ?? COMMUNITY_TEMPLATE.id },
            at: clock.now(),
          });
        }
        return { covered: a.covered, missing: a.missing?.area ?? null };
      },
    },
    {
      name: "open_companion_builder",
      description: "Open the Companion Builder to create the Community companion (Customer Voice Lead). The user reviews and activates it themselves.",
      execute() {
        if (getCompanion(COMMUNITY_TEMPLATE.id)) return "Community is already on the team.";
        useUI.getState().openBuilder(COMMUNITY_TEMPLATE.id);
        return "Builder opened. The user must press Activate and confirm.";
      },
    },
    {
      name: "delegate_task",
      description: "Send one task to one companion. They search the Brain, do the work, save a result, and report back in a few seconds. Returns immediately.",
      inputSchema: {
        type: "object",
        properties: {
          companion: { type: "string", description: "builder, marketer, counsel, scout, or community" },
          task: { type: "string", description: "The task in plain words, starting with a verb" },
        },
        required: ["companion", "task"],
      },
      execute(input) {
        const to = name(input.companion);
        const task = String(input.task ?? "").trim();
        if (!getCompanion(to)) throw new Error(`${to || "That companion"} is not on the team`);
        if (!task) throw new Error("No task given");
        const playbook = choosePlaybook(to, task);
        const title =
          playbook === "feedback-strategy"
            ? "Launch-day customer feedback strategy"
            : playbook === "roadmap-review"
              ? "Review strategy and prepare build plan"
              : task.charAt(0).toUpperCase() + task.slice(1).replace(/[.?!]+$/, "");
        run(delegateOne({ to, instruction: task, playbook, title }));
        return `Delegated to ${getCompanion(to)!.name}.`;
      },
    },
    {
      name: "dispatch_all",
      description: "Send a launch-readiness task to every companion at once; they work in parallel and Core posts a combined summary when all finish.",
      execute() {
        run(dispatchAll(DISPATCH_TASKS, DISPATCH_DURATIONS, PREVIEW_FAILURES));
        return `Dispatched to ${useCompanions.getState().companions.length} companions.`;
      },
    },
    {
      name: "competitor_campaign_chain",
      description: "Marketer asks Scout to research competitors (Scout spawns research workers), then Marketer turns the findings into campaign ideas.",
      execute() {
        run(runCampaignChain());
        return "Chain started: Marketer -> Scout -> Marketer.";
      },
    },
    {
      name: "connect_gmail",
      description: "Show the Gmail connection card so the user can authorize Gmail (simulated, Preview Mode).",
      execute() {
        requestGmailConnection();
        return useIntegrations.getState().integrations.find((i) => i.id === "gmail")!.status;
      },
    },
    {
      name: "draft_email",
      description: "Draft an email for the user's approval. It is never sent until they press Approve, and in Preview Mode it is only marked MOCK SENT.",
      inputSchema: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "Recipient's first name" },
          topic: { type: "string", description: "What the email is about" },
        },
        required: ["first_name", "topic"],
      },
      execute(input) {
        const first = String(input.first_name ?? "").replace(/[^a-z]/gi, "");
        if (!first) throw new Error("Need a recipient's first name");
        const a = draftEmail(first, String(input.topic ?? "the launch"));
        return `Draft to ${a.payload.to} is waiting for approval. Subject: ${a.payload.subject}`;
      },
    },
    {
      name: "remember",
      description: "Save a lasting fact or preference about the user to long-term memory.",
      inputSchema: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"] },
      execute(input) {
        const fact = String(input.fact ?? "").trim();
        if (!fact) throw new Error("Nothing to remember");
        useContext.getState().addMemory({ id: uid("mem"), kind: "fact", text: fact, updatedAt: clock.now() });
        return "Saved.";
      },
    },
    {
      name: "read_brain_entry",
      description: "Read the full content of a Brain entry by (part of) its title. Use it before answering detailed questions about saved work.",
      inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
      execute(input) {
        const q = name(input.title);
        const e = useKnowledge.getState().entries.find((x) => x.title.toLowerCase().includes(q));
        if (!e) throw new Error(`No entry matching "${q}"`);
        return { title: e.title, folder: e.folder, by: e.createdBy, content: e.content };
      },
    },
  ];
}

/** Recent Core-thread turns, shaped for the model. Cards are summarized by their text line. */
export function recentTurns(messages: ChatMessage[], limit = 12): AITurn[] {
  const turns: AITurn[] = messages
    .filter((m) => m.thread === "core")
    .slice(-limit)
    .map((m) => ({ role: m.author === "user" ? "user" : "assistant", content: m.text }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

/**
 * One smart Core turn: Claude reads the workspace, may call tools that drive the
 * real app, and returns a short spoken reply. Background work is collected so
 * callers (and tests) can wait for it.
 */
export async function smartCoreReply(provider: AIProvider, background: Promise<unknown>[]): Promise<string> {
  const turns = recentTurns(useConversation.getState().messages);
  const input: AITurn[] = [{ role: "user", content: `${RULES}\n\nCurrent workspace:\n${workspaceContext()}` }, ...turns];
  const text = await provider.chat(input, provider.supportsTools ? { tools: coreTools(background) } : {});
  return text.trim();
}
