import { COMMUNITY_TEMPLATE } from "../data/seed";
import { getCompanion, useCompanions } from "../state/companionStore";
import { useContext } from "../state/contextStore";
import { useConversation } from "../state/conversationStore";
import { useDelegations } from "../state/delegationStore";
import { useUI } from "../state/uiStore";
import { TERMINAL_STATUSES, type ThreadId } from "../types/models";
import { clock } from "./clock";
import { createDelegation, delegateOne, dispatchAll, runCampaignChain, runDelegation } from "./engine";
import { activity, say } from "./events";
import { draftEmail, requestGmailConnection } from "./gmail";
import { uid } from "./ids";
import { DEMO_COMMANDS, parseIntent, type Intent } from "./intents";
import { DISPATCH_DURATIONS, DISPATCH_TASKS } from "./playbooks";
import { analyzeTeam } from "./teamAnalysis";

/** Simulated failure used to show partial-failure handling during dispatch. */
export const PREVIEW_DISPATCH_FAILURES: Record<string, string> = {
  counsel: "Policy library is unavailable in Preview Mode",
};

async function speak<T>(work: () => Promise<T> | T): Promise<T> {
  const conv = useConversation.getState();
  conv.setPending("core", true);
  conv.setVoice("thinking");
  await clock.sleep(700);
  try {
    return await work();
  } finally {
    conv.setPending("core", false);
    conv.setVoice("speaking");
    setTimeout(() => {
      if (useConversation.getState().voice === "speaking") useConversation.getState().setVoice("idle");
    }, 1800 * clock.speed);
  }
}

/** Entry point for every message the user sends. Resolves when all triggered work has finished. */
export async function handleUserMessage(text: string, thread: ThreadId = "core"): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  say(thread, "user", trimmed);
  if (thread !== "core") return askCompanionDirectly(thread, trimmed);

  let background: Promise<unknown> | null = null;
  await speak(() => {
    background = route(parseIntent(trimmed));
  });
  if (background) await background;
}

function needCompanion(id: string): boolean {
  if (getCompanion(id)) return true;
  if (id === COMMUNITY_TEMPLATE.id) {
    say("core", "core", `Community isn't on your team yet. Ask "What is missing from my team for a product launch?" or say "Create that companion."`);
  } else {
    say("core", "core", `There's no companion called ${id} on your roster.`);
  }
  return false;
}

function route(intent: Intent): Promise<unknown> | null {
  switch (intent.kind) {
    case "team-gap": {
      const { companions } = useCompanions.getState();
      const goal = useContext.getState().workspaceGoal;
      const a = analyzeTeam(companions, goal);
      if (!a.missing) {
        say("core", "core", `Your team covers ${a.covered.join(", ")}. Nothing essential is missing for a product launch.`);
        return null;
      }
      say(
        "core",
        "core",
        `Your team covers ${a.covered.join(", ")}. The missing role is ${a.missing.area}: someone responsible for beta feedback, user interviews, and early community signals.`,
        { type: "team-gap", covered: a.covered, missing: a.missing.area, facts: a.facts, templateId: a.missing.templateId ?? COMMUNITY_TEMPLATE.id },
      );
      activity("core", "companion", "Core reviewed the roster against the launch goal");
      return null;
    }

    case "create-companion": {
      if (getCompanion(COMMUNITY_TEMPLATE.id)) {
        say("core", "core", "Community is already on your team. Pick the Community tab to talk to them.");
        return null;
      }
      say("core", "core", "Opening the Companion Builder with Community, the Customer Voice Lead. Review it, then activate.");
      useUI.getState().openBuilder(COMMUNITY_TEMPLATE.id);
      return null;
    }

    case "connect":
      requestGmailConnection();
      return null;

    case "email":
      draftEmail(intent.name, intent.topic);
      return null;

    case "dispatch":
      say("core", "core", "Sending a dispatch to every companion.", {
        type: "plan",
        steps: useCompanions
          .getState()
          .companions.map((c) => `${c.name}: ${DISPATCH_TASKS[c.id] ?? "Share a launch-readiness update"}`),
      });
      return dispatchAll(DISPATCH_TASKS, DISPATCH_DURATIONS, PREVIEW_DISPATCH_FAILURES);

    case "chain":
      if (!needCompanion("marketer") || !needCompanion("scout")) return null;
      say("core", "core", "Here's the plan.", {
        type: "plan",
        steps: [
          "Core delegates the campaign to Marketer",
          "Marketer delegates competitor research to Scout",
          "Scout runs research workers and returns findings",
          "Marketer drafts campaign ideas from the findings",
          "Core summarizes the result for you",
        ],
      });
      return runCampaignChain();

    case "delegate": {
      if (!needCompanion(intent.to)) return null;
      const c = getCompanion(intent.to)!;
      if (intent.playbook !== "generic") {
        say("core", "core", `Plan for ${c.name}:`, {
          type: "plan",
          steps: [`Search ${c.knowledgeFolders.map((f) => f.folder).join(", ")} in the Brain`, ...stepsFor(intent.playbook), "Save the result to the Brain and report back"],
        });
      }
      return delegateOne({ to: c.id, instruction: intent.instruction, playbook: intent.playbook, title: titleFor(intent) });
    }

    case "remember": {
      useContext.getState().addMemory({ id: uid("mem"), kind: "fact", text: intent.text, updatedAt: clock.now() });
      say("core", "core", `Saved to memory: "${intent.text}". You can edit or forget it in Memory.`);
      return null;
    }

    case "status": {
      const busy = useCompanions.getState().companions.filter((c) => c.status === "BUSY");
      const open = useDelegations.getState().delegations.filter((d) => !TERMINAL_STATUSES.includes(d.status));
      say(
        "core",
        "core",
        busy.length
          ? `${busy.map((c) => `${c.name} is working on "${c.currentTask}"`).join(". ")}. ${open.length} delegation${open.length === 1 ? "" : "s"} open.`
          : "Everyone is idle. No delegations are running.",
      );
      return null;
    }

    case "help":
      say(
        "core",
        "core",
        `I'm Core, your conductor. I can review your team, create companions, delegate work, connect Gmail in Preview Mode, and draft emails for approval. Try: "${DEMO_COMMANDS[0]}"`,
      );
      return null;
  }
}

function stepsFor(playbook: string): string[] {
  switch (playbook) {
    case "feedback-strategy":
      return ["Review the launch goal and roadmap", "Design outreach and feedback tiers"];
    case "roadmap-review":
      return ["Find Community's customer feedback strategy", "Prepare next week's build plan"];
    case "competitor-research":
      return ["Launch research workers", "Validate sources"];
    default:
      return ["Do the work"];
  }
}

function titleFor(intent: Extract<Intent, { kind: "delegate" }>): string {
  if (intent.playbook === "feedback-strategy") return "Launch-day customer feedback strategy";
  if (intent.playbook === "roadmap-review") return "Review strategy and prepare build plan";
  const t = intent.instruction.replace(/[.?!]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A direct question typed into a companion's tab. */
async function askCompanionDirectly(thread: ThreadId, question: string): Promise<void> {
  const c = getCompanion(thread);
  if (!c) return;
  const conv = useConversation.getState();
  conv.setPending(thread, true);
  const d = createDelegation({ to: c.id, from: "core", instruction: question, playbook: "direct-question", title: `Question: ${question.slice(0, 48)}` });
  try {
    await runDelegation(d.id, { durationMs: 1600 });
  } finally {
    useConversation.getState().setPending(thread, false);
  }
}
