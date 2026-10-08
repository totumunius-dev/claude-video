import type { Production, PlaybookContext } from "../core/playbooks";
import { useConversation } from "../state/conversationStore";
import type { AIProvider } from "./provider";

const brainExcerpt = (ctx: PlaybookContext) =>
  ctx.knowledge
    .slice(0, 6)
    .map((k) => `- [${k.folder}] ${k.title}: ${k.summary}\n  ${k.content.slice(0, 4).join("; ")}`)
    .join("\n") || "- (no permitted entries matched)";

const identity = (ctx: PlaybookContext) => {
  const c = ctx.companion;
  return `You are ${c.name}, the ${c.role} companion in NOVA_OS. Persona: ${c.persona.voice}; ${c.persona.traits.join(", ")}. Skills: ${c.skills
    .map((s) => s.name)
    .join(", ")}. You may only use these Brain entries (your permitted folders: ${c.knowledgeFolders.map((f) => f.folder).join(", ")}):\n${brainExcerpt(ctx)}`;
};

/** A companion answering a question typed into its own tab. */
export async function smartAnswer(provider: AIProvider, ctx: PlaybookContext): Promise<Production> {
  const thread = useConversation
    .getState()
    .messages.filter((m) => m.thread === ctx.companion.id && m.text)
    .slice(-8)
    .map((m) => ({ role: m.author === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
  while (thread.length && thread[0].role !== "user") thread.shift();
  if (!thread.length || thread[thread.length - 1].role !== "user") thread.push({ role: "user", content: ctx.instruction });
  const rules = `${identity(ctx)}\n\nReply in your own voice in 2 to 4 short spoken sentences, no markdown or lists. Ground your answer in the Brain entries above when they are relevant and name the entry you used. This is Preview Mode with mock data.`;
  const text = await provider.chat([{ role: "user", content: rules }, ...thread]);
  return { summary: text.trim(), bullets: [] };
}

/** A companion doing an open-ended delegated task. */
export async function smartWork(provider: AIProvider, ctx: PlaybookContext): Promise<Production> {
  const prompt = `${identity(ctx)}

Task from Core: ${ctx.instruction}
${ctx.inputs.length ? `Results handed to you:\n${ctx.inputs.map((i) => `- ${i.summary} ${i.bullets.join("; ")}`).join("\n")}` : ""}

Do the task as well as you can with what you know. Reply with only JSON:
{"title": "short Brain entry title", "summary": "one sentence result for Core", "bullets": ["3 to 5 concrete points"]}`;
  const r = await provider.json<{ title?: unknown; summary?: unknown; bullets?: unknown }>(prompt);
  const bullets = Array.isArray(r.bullets) ? r.bullets.map(String).filter(Boolean).slice(0, 6) : [];
  const summary = String(r.summary ?? "").trim();
  if (!summary || !bullets.length) throw new Error("Incomplete answer");
  const title = String(r.title ?? ctx.instruction).trim().slice(0, 80);
  return {
    summary,
    bullets,
    entry: {
      title,
      summary,
      content: bullets,
      folder: ctx.companion.knowledgeFolders[0]?.folder ?? "Operations",
      tags: [ctx.companion.id, "delegation"],
      linkFrom: ctx.knowledge.slice(0, 2).map((k) => k.id),
      linkTo: [],
    },
  };
}
