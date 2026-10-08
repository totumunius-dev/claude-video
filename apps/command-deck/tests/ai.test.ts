import { afterEach, describe, expect, it, vi } from "vitest";
import { useAI, type AIProvider, type AITool, type AITurn } from "../src/ai/provider";
import { activateCompanion } from "../src/core/companions";
import { handleUserMessage } from "../src/core/conductor";
import { COMMUNITY_TEMPLATE } from "../src/data/seed";
import { useContext } from "../src/state/contextStore";
import { useApprovals } from "../src/state/approvalStore";
import { useConversation } from "../src/state/conversationStore";
import { useDelegations } from "../src/state/delegationStore";
import { useKnowledge } from "../src/state/knowledgeStore";
import { useUI } from "../src/state/uiStore";
import { speak, speakable } from "../src/voice/speech";

type Script = (turns: AITurn[], tools: AITool[]) => Promise<string>;

function fakeClaude(script: Script, json: unknown = null): AIProvider & { calls: AITurn[][] } {
  const calls: AITurn[][] = [];
  return {
    label: "fake",
    supportsTools: true,
    calls,
    chat: async (turns, opts) => {
      calls.push(turns);
      return script(turns, opts?.tools ?? []);
    },
    json: async <T,>() => json as T,
  };
}

const use = (p: AIProvider) => useAI.getState().set(p, "ready");
const tool = (tools: AITool[], name: string) => tools.find((t) => t.name === name)!;
const coreMessages = () => useConversation.getState().messages.filter((m) => m.thread === "core");

describe("smart Core", () => {
  it("sends workspace context and the conversation, then posts the reply", async () => {
    const p = fakeClaude(async () => "Morning! Builder and Scout are free if you need them.");
    use(p);
    await handleUserMessage("hey, who's around today?");
    const [rules, ...turns] = p.calls[0];
    expect(rules.content).toMatch(/You are Core/);
    expect(rules.content).toMatch(/Workspace goal: Launch NOVA_OS/);
    expect(rules.content).toMatch(/Product Roadmap - v1 Beta/);
    expect(turns.at(-1)).toEqual({ role: "user", content: "hey, who's around today?" });
    expect(coreMessages().at(-1)!.text).toBe("Morning! Builder and Scout are free if you need them.");
  });

  it("acts through tools: delegating open-ended work that the companion completes with the model", async () => {
    use(
      fakeClaude(
        async (_t, tools) => {
          await tool(tools, "delegate_task").execute({ companion: "scout", task: "size the market for voice assistants" });
          return "Scout is on the market sizing now.";
        },
        { title: "Voice Assistant Market Size", summary: "Roughly a $6B market growing 25% a year.", bullets: ["Consumer leads", "Enterprise is fastest growing", "Pricing is $20-40/mo"] },
      ),
    );
    await handleUserMessage("how big is the market for this?");
    const d = useDelegations.getState().delegations.find((x) => x.to === "scout")!;
    expect(d.status).toBe("COMPLETED");
    expect(d.result?.summary).toMatch(/\$6B/);
    expect(useKnowledge.getState().entries.find((e) => e.title === "Voice Assistant Market Size")?.folder).toBe("Research");
    expect(coreMessages().some((m) => m.text === "Scout is on the market sizing now.")).toBe(true);
  });

  it("drafts email and opens the builder only through the app's own flows", async () => {
    use(
      fakeClaude(async (_t, tools) => {
        await tool(tools, "draft_email").execute({ first_name: "Sarah", topic: "the beta date" });
        await tool(tools, "open_companion_builder").execute({});
        return "Drafted it for your approval, and the builder is open.";
      }),
    );
    await handleUserMessage("tell sarah about the beta date and let's add someone for customer feedback");
    expect(useApprovals.getState().approvals[0]).toMatchObject({ status: "WAITING_FOR_APPROVAL", payload: { to: "sarah@preview.example" } });
    expect(useUI.getState().builderOpen).toBe("community");
  });

  it("rejects delegation to someone not on the team", async () => {
    let error = "";
    use(
      fakeClaude(async (_t, tools) => {
        try {
          await tool(tools, "delegate_task").execute({ companion: "community", task: "plan interviews" });
        } catch (e) {
          error = String(e);
        }
        return "Community isn't on the team yet.";
      }),
    );
    await handleUserMessage("have community plan interviews");
    expect(error).toMatch(/not on the team/);
    expect(useDelegations.getState().delegations).toHaveLength(0);
  });

  it("falls back to quick commands when the viewer declines Claude", async () => {
    use(fakeClaude(async () => Promise.reject({ code: "not_granted", message: "no" })));
    await handleUserMessage("What is missing from my team for a product launch?");
    expect(useAI.getState().status).toBe("denied");
    expect(coreMessages().at(-1)!.text).toMatch(/missing role is customer voice/);
  });
});

describe("smart companions", () => {
  it("answer direct questions in their own tab using their Brain access", async () => {
    activateCompanion(structuredClone(COMMUNITY_TEMPLATE));
    const p = fakeClaude(async () => "From the Launch Goal entry, we need 100 feedback reports in week one.");
    use(p);
    await handleUserMessage("what does success look like?", "community");
    const prompt = p.calls[0][0].content;
    expect(prompt).toMatch(/You are Community/);
    expect(prompt).toMatch(/Launch Goal and Success Metrics/);
    expect(prompt).not.toMatch(/Legal Review/); // Community can't read Legal
    const reply = useConversation.getState().messages.filter((m) => m.thread === "community").at(-1)!;
    expect(reply.text).toMatch(/100 feedback reports/);
  });
});

describe("voice", () => {
  const spoken: string[] = [];
  afterEach(() => {
    spoken.length = 0;
    vi.unstubAllGlobals();
  });
  const stubSpeech = () => {
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      text: string;
      onstart?: () => void;
      onend?: () => void;
      constructor(t: string) {
        this.text = t;
      }
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel() {},
        speak(u: { text: string; onend?: () => void }) {
          spoken.push(u.text);
          u.onend?.();
        },
      },
    });
  };

  it("cleans text for speaking", () => {
    expect(speakable("**Done.** See https://x.y\n- one\n- two")).toBe("Done. See. one. two");
  });

  it("speaks only Core's final reply in a smart turn, not the tool chatter", async () => {
    stubSpeech();
    use(
      fakeClaude(async (_t, tools) => {
        await tool(tools, "connect_gmail").execute({});
        return "I've put the Gmail card in the chat for you.";
      }),
    );
    await handleUserMessage("hook up my email");
    expect(spoken).toEqual(["I've put the Gmail card in the chat for you."]);
  });

  it("stays quiet when voice replies are off", () => {
    stubSpeech();
    speak("hello");
    useContext.getState().setVoicePrefs({ voiceReplies: false });
    speak("are you there?");
    expect(spoken).toEqual(["hello"]);
  });
});
