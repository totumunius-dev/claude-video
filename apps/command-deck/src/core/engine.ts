import { getCompanion, useCompanions } from "../state/companionStore";
import { getDelegation, useDelegations } from "../state/delegationStore";
import { useKnowledge } from "../state/knowledgeStore";
import {
  TERMINAL_STATUSES,
  type Companion,
  type CompanionId,
  type Delegation,
  type DelegationResult,
  type Flow,
  type FlowKind,
  type Id,
  type KnowledgeEntry,
  type PlaybookKind,
} from "../types/models";
import { clock } from "./clock";
import { activity, log, notify, say } from "./events";
import { uid } from "./ids";
import { readableFolders, searchKnowledge } from "./knowledge";
import { PLAYBOOKS, type EntryDraft } from "./playbooks";

const name = (id: "core" | CompanionId) => (id === "core" ? "Core" : getCompanion(id)?.name ?? id);

/* ---------- flows ---------- */

export function createFlow(title: string, kind: FlowKind, status: Flow["status"] = "RUNNING"): Flow {
  const f: Flow = { id: uid("flow"), title, kind, status, delegationIds: [], createdAt: clock.now(), updatedAt: clock.now() };
  useDelegations.getState().addFlow(f);
  return f;
}

function attachToFlow(flowId: Id | null, delegationId: Id) {
  if (!flowId) return;
  const f = useDelegations.getState().flows.find((x) => x.id === flowId);
  if (f) useDelegations.getState().updateFlow(flowId, { delegationIds: [...f.delegationIds, delegationId] });
}

/* ---------- creating delegations ---------- */

export interface DelegateInput {
  to: CompanionId;
  instruction: string;
  playbook: PlaybookKind;
  from?: "core" | CompanionId;
  flowId?: Id | null;
  parentId?: Id | null;
  title?: string;
}

export function createDelegation(input: DelegateInput): Delegation {
  const pb = PLAYBOOKS[input.playbook];
  const from = input.from ?? "core";
  const now = clock.now();
  const d: Delegation = {
    id: uid("dlg"),
    title: input.title ?? input.instruction,
    instruction: input.instruction,
    from,
    to: input.to,
    playbook: input.playbook,
    status: "DELEGATED",
    progress: 0,
    steps: pb.steps.map((label) => ({ id: uid("step"), label, status: "pending", at: null })),
    flowId: input.flowId ?? null,
    parentId: input.parentId ?? null,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const store = useDelegations.getState();
  store.addDelegation(d);
  store.addEdge({ id: uid("edge"), from, to: input.to, delegationId: d.id, label: d.title, createdAt: now });
  attachToFlow(d.flowId, d.id);
  activity(from, "edge", `${name(from)} delegated to ${name(input.to)}: ${d.title}`, d.id);
  log("delegation", `${d.id} ${name(from)} -> ${name(input.to)} [DELEGATED] ${d.title}`);
  return d;
}

/* ---------- running ---------- */

export interface RunOptions {
  /** Simulated failure message, used for partial-failure dispatch. */
  failWith?: string;
  /** Results handed in from earlier links of a chain. */
  inputs?: DelegationResult[];
  /** Ask another companion first and wait for its result (delegation chains). */
  subDelegate?: { to: CompanionId; instruction: string; playbook: PlaybookKind; title?: string };
  durationMs?: number;
}

function update(id: Id, patch: Partial<Delegation>) {
  useDelegations.getState().updateDelegation(id, patch);
}

function setStep(id: Id, index: number, status: "running" | "done" | "failed") {
  const d = getDelegation(id);
  if (!d || !d.steps[index]) return;
  const steps = d.steps.map((s, i) => (i === index ? { ...s, status, at: clock.now() } : s));
  const done = steps.filter((s) => s.status === "done").length;
  update(id, { steps, progress: Math.min(0.98, done / steps.length + (status === "running" ? 0.5 / steps.length : 0)) });
}

function saveEntry(draft: EntryDraft, companion: Companion, used: KnowledgeEntry[]): KnowledgeEntry {
  const kb = useKnowledge.getState();
  const existing = kb.entries.find((e) => e.title === draft.title);
  const now = clock.now();
  const entry: KnowledgeEntry = {
    id: existing?.id ?? uid("kb"),
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    folder: draft.folder,
    tags: draft.tags,
    createdBy: companion.id,
    relatedCompanions: Array.from(new Set([companion.id, ...used.map((u) => u.createdBy).filter((c) => c !== "core" && c !== "user")])),
    linkedEntries: Array.from(new Set([...(existing?.linkedEntries ?? []), ...draft.linkTo])),
    source: `Delegation to ${companion.name}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: "active",
  };
  kb.add(entry);
  for (const from of draft.linkFrom) useKnowledge.getState().link(from, entry.id);
  activity(companion.id, "knowledge", `${companion.name} saved "${entry.title}" to ${entry.folder}`);
  log("brain", `${existing ? "updated" : "created"} ${entry.id} in ${entry.folder}`);
  return entry;
}

async function runSubAgents(d: Delegation, companion: Companion): Promise<string[]> {
  const specs = PLAYBOOKS[d.playbook].subAgents ?? [];
  const store = useDelegations.getState();
  const agents = specs.map((s) => {
    const a = {
      id: uid("sub"),
      name: s.name,
      parentCompanionId: companion.id,
      delegationId: d.id,
      status: "SPAWNED" as const,
      result: null,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };
    store.addSubAgent(a);
    return { a, s };
  });
  activity(companion.id, "subagent", `${companion.name} launched ${agents.length} research workers: ${specs.map((s) => s.name).join(", ")}`, d.id);
  return Promise.all(
    agents.map(async ({ a, s }) => {
      useDelegations.getState().updateSubAgent(a.id, { status: "EXECUTING" });
      activity(companion.id, "subagent", `${s.name} started (parent: ${companion.name})`, d.id);
      await clock.sleep(s.durationMs);
      useDelegations.getState().updateSubAgent(a.id, { status: "COMPLETED", result: s.result });
      activity(companion.id, "subagent", `${s.name} returned findings to ${companion.name}`, d.id);
      await clock.sleep(1200);
      useDelegations.getState().updateSubAgent(a.id, { status: "ARCHIVED" });
      log("subagent", `${a.id} ${s.name} archived`);
      return s.result;
    }),
  );
}

/**
 * Walks a delegation through QUEUED -> EXECUTING -> COMPLETED/FAILED, doing a mock
 * knowledge retrieval first. Only user-facing activity lines are emitted.
 */
export async function runDelegation(id: Id, opts: RunOptions = {}): Promise<Delegation> {
  let d = getDelegation(id);
  if (!d) throw new Error(`Unknown delegation ${id}`);
  const companion = getCompanion(d.to);
  if (!companion) {
    update(id, { status: "FAILED", error: `${d.to} is not on the roster` });
    return getDelegation(id)!;
  }
  const pb = PLAYBOOKS[d.playbook];
  const companions = useCompanions.getState();
  const run = { id: uid("run"), companionId: companion.id, delegationId: id, startedAt: clock.now(), finishedAt: null, outcome: "running" as const };

  await clock.sleep(400);
  update(id, { status: "QUEUED" });
  activity(companion.id, "status", `${companion.name} queued: ${d.title}`, id);
  await clock.sleep(500);

  useDelegations.getState().addRun(run);
  companions.update(companion.id, { status: "BUSY", currentTask: d.title });
  companions.logActivity(companion.id, `Started: ${d.title}`);
  update(id, { status: "EXECUTING" });
  activity(companion.id, "status", `${companion.name} started: ${d.title}`, id);

  const totalSteps = d.steps.length;
  const stepMs = (opts.durationMs ?? pb.durationMs) / totalSteps;
  let stepIndex = 0;

  // Step 1 is always knowledge retrieval, limited to the companion's folders.
  setStep(id, stepIndex, "running");
  const searchFolders = pb.folders ?? readableFolders(companion);
  let knowledge = searchKnowledge(companion, { folders: pb.folders, terms: pb.terms });
  if (!knowledge.length && d.playbook !== "dispatch") knowledge = searchKnowledge(companion, { folders: pb.folders }).slice(0, 3);
  await clock.sleep(stepMs);
  activity(
    companion.id,
    "knowledge",
    `${companion.name} searched ${searchFolders.join(", ")} and used ${knowledge.length} ${knowledge.length === 1 ? "entry" : "entries"}`,
    id,
  );
  setStep(id, stepIndex++, "done");

  let inputs = opts.inputs ?? [];
  if (opts.subDelegate) {
    setStep(id, stepIndex, "running");
    const child = createDelegation({
      ...opts.subDelegate,
      from: companion.id,
      flowId: d.flowId,
      parentId: id,
    });
    const finished = await runDelegation(child.id);
    if (finished.status !== "COMPLETED" || !finished.result) {
      return fail(id, companion, run.id, `${name(child.to)} could not finish the research`);
    }
    activity(child.to, "edge", `${name(child.to)} returned findings to ${companion.name}`, id);
    inputs = [...inputs, finished.result];
    // The child's entry is now readable by this companion too.
    knowledge = Array.from(new Map([...knowledge, ...searchKnowledge(companion, { terms: pb.terms })].map((k) => [k.id, k])).values());
    setStep(id, stepIndex++, "done");
  }

  let subAgentResults: string[] = [];
  if (pb.subAgents?.length) {
    setStep(id, stepIndex, "running");
    subAgentResults = await runSubAgents(getDelegation(id)!, companion);
    setStep(id, stepIndex++, "done");
  }

  while (stepIndex < totalSteps - 1) {
    setStep(id, stepIndex, "running");
    await clock.sleep(stepMs);
    setStep(id, stepIndex++, "done");
  }

  setStep(id, stepIndex, "running");
  await clock.sleep(stepMs);

  d = getDelegation(id)!;
  if (d.status === "CANCELLED") return finishCancelled(id, companion, run.id);
  if (opts.failWith) return fail(id, companion, run.id, opts.failWith, stepIndex);

  const production = pb.produce({ companion: getCompanion(companion.id)!, instruction: d.instruction, knowledge, inputs, subAgentResults });
  const created = production.entry ? [saveEntry(production.entry, companion, knowledge)] : [];
  const result: DelegationResult = {
    summary: production.summary,
    bullets: production.bullets,
    knowledgeUsed: knowledge.map((k) => k.id),
    knowledgeCreated: created.map((c) => c.id),
  };
  setStep(id, stepIndex, "done");
  update(id, { status: "COMPLETED", progress: 1, result });
  useDelegations.getState().updateRun(run.id, { finishedAt: clock.now(), outcome: "completed" });
  useCompanions.getState().update(companion.id, { status: "IDLE", currentTask: null, lastRun: clock.now() });
  useCompanions.getState().logActivity(companion.id, `Completed: ${d.title}`);
  activity(companion.id, "delegation", `${companion.name} completed: ${d.title}`, id);
  log("delegation", `${id} [COMPLETED] used=${result.knowledgeUsed.length} created=${result.knowledgeCreated.length}`);
  say(companion.id, companion.id, production.summary, { type: "result", delegationId: id });
  return getDelegation(id)!;
}

function fail(id: Id, companion: Companion, runId: Id, error: string, stepIndex?: number): Delegation {
  if (stepIndex !== undefined) setStep(id, stepIndex, "failed");
  update(id, { status: "FAILED", error });
  useDelegations.getState().updateRun(runId, { finishedAt: clock.now(), outcome: "failed" });
  useCompanions.getState().update(companion.id, { status: "IDLE", currentTask: null, lastRun: clock.now() });
  useCompanions.getState().logActivity(companion.id, `Failed: ${error}`);
  activity(companion.id, "error", `${companion.name} failed: ${error}`, id);
  log("delegation", `${id} [FAILED] ${error}`, "error");
  return getDelegation(id)!;
}

function finishCancelled(id: Id, companion: Companion, runId: Id): Delegation {
  useDelegations.getState().updateRun(runId, { finishedAt: clock.now(), outcome: "cancelled" });
  useCompanions.getState().update(companion.id, { status: "IDLE", currentTask: null });
  activity(companion.id, "status", `${companion.name} stopped: delegation cancelled`, id);
  return getDelegation(id)!;
}

export function cancelDelegation(id: Id) {
  const d = getDelegation(id);
  if (!d || TERMINAL_STATUSES.includes(d.status)) return;
  update(id, { status: "CANCELLED" });
  log("delegation", `${id} [CANCELLED] by user`, "warn");
}

export function archiveDelegation(id: Id) {
  const d = getDelegation(id);
  if (!d || !TERMINAL_STATUSES.includes(d.status)) return;
  update(id, { status: "ARCHIVED" });
}

/* ---------- higher-level orchestrations ---------- */

function postResultToCore(d: Delegation) {
  if (d.status === "COMPLETED" && d.result) {
    say("core", "core", `${name(d.to)} finished "${d.title}".`, { type: "result", delegationId: d.id });
    notify(`${name(d.to)} completed: ${d.title}`);
  } else if (d.status === "FAILED") {
    say("core", "core", `${name(d.to)} could not finish "${d.title}": ${d.error}`, { type: "result", delegationId: d.id });
    notify(`${name(d.to)} failed: ${d.title}`, "error");
  }
}

/** Core -> one companion, result returned to Core chat. */
export async function delegateOne(input: DelegateInput): Promise<Delegation> {
  const flow = createFlow(`${name(input.to)}: ${input.title ?? input.instruction}`, "single");
  const d = createDelegation({ ...input, flowId: flow.id });
  say("core", "core", `Delegated to ${name(input.to)}. I'll let you know when it's done.`, {
    type: "delegation",
    delegationIds: [d.id],
    flowId: flow.id,
  });
  const done = await runDelegation(d.id);
  useDelegations.getState().updateFlow(flow.id, { status: done.status === "COMPLETED" ? "COMPLETED" : "FAILED" });
  postResultToCore(done);
  return done;
}

/** Parallel dispatch to every roster companion. Counsel fails in Preview to exercise partial failure. */
export async function dispatchAll(
  tasks: Record<string, string>,
  durations: Record<string, number>,
  failures: Record<string, string> = {},
): Promise<Delegation[]> {
  const roster = useCompanions.getState().companions.filter((c) => c.status !== "DRAFT");
  const flow = createFlow("Dispatch to every companion", "dispatch");
  const ds = roster.map((c) =>
    createDelegation({ to: c.id, instruction: tasks[c.id] ?? "Share a launch-readiness update", playbook: "dispatch", flowId: flow.id }),
  );
  const count = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"][ds.length] ?? String(ds.length);
  say("core", "core", `${count} companions are working in parallel.`, { type: "delegation", delegationIds: ds.map((d) => d.id), flowId: flow.id });
  const finished = await Promise.all(
    ds.map((d) => runDelegation(d.id, { durationMs: durations[d.to], failWith: failures[d.to] })),
  );
  const ok = finished.filter((d) => d.status === "COMPLETED");
  const status = ok.length === finished.length ? "COMPLETED" : ok.length ? "PARTIAL" : "FAILED";
  useDelegations.getState().updateFlow(flow.id, { status });
  const failed = finished.length - ok.length;
  say(
    "core",
    "core",
    failed
      ? `Dispatch finished: ${ok.length} of ${finished.length} completed, ${failed} failed. You can retry the failed task below.`
      : `Dispatch finished: all ${finished.length} companions completed.`,
    {
      type: "summary",
      flowId: flow.id,
      lines: finished.map((d) => ({ companionId: d.to, ok: d.status === "COMPLETED", text: d.result?.summary ?? d.error ?? "" })),
    },
  );
  notify(failed ? `Dispatch done with ${failed} failure` : "Dispatch complete", failed ? "warn" : "ok");
  return finished;
}

/** Core -> Marketer -> Scout (+ sub-agents) -> Marketer -> Core. */
export async function runCampaignChain(): Promise<Delegation> {
  const flow = createFlow("Competitor research to campaign ideas", "chain");
  const d = createDelegation({
    to: "marketer",
    instruction: "Ask Scout to research competitors, then turn the findings into campaign ideas",
    title: "Competitor-informed campaign ideas",
    playbook: "campaign-ideas",
    flowId: flow.id,
  });
  // The chain adds a "wait for Scout" step after retrieval.
  const steps = useDelegations.getState().delegations.find((x) => x.id === d.id)!.steps;
  useDelegations.getState().updateDelegation(d.id, {
    steps: [steps[0], { id: uid("step"), label: "Delegate research to Scout", status: "pending", at: null }, ...steps.slice(1)],
  });
  say("core", "core", "Marketer is on it and will bring Scout in for the research.", {
    type: "delegation",
    delegationIds: [d.id],
    flowId: flow.id,
  });
  const done = await runDelegation(d.id, {
    subDelegate: { to: "scout", instruction: "Research competitors for the launch campaign", title: "Competitor analysis", playbook: "competitor-research" },
  });
  useDelegations.getState().updateFlow(flow.id, { status: done.status === "COMPLETED" ? "COMPLETED" : "FAILED" });
  if (done.status === "COMPLETED") activity("marketer", "delegation", "Marketer drafted campaign ideas and returned them to Core", d.id);
  postResultToCore(done);
  return done;
}

export async function retryDelegation(id: Id): Promise<Delegation | undefined> {
  const d = getDelegation(id);
  if (!d || d.status !== "FAILED") return d;
  update(id, {
    status: "DELEGATED",
    error: null,
    progress: 0,
    steps: d.steps.map((s) => ({ ...s, status: "pending", at: null })),
  });
  activity("core", "delegation", `Core retried: ${d.title}`, id);
  const done = await runDelegation(id);
  if (d.flowId) {
    const flow = useDelegations.getState().flows.find((f) => f.id === d.flowId);
    const all = flow?.delegationIds.map((x) => getDelegation(x)) ?? [];
    if (flow && all.every((x) => x?.status === "COMPLETED")) useDelegations.getState().updateFlow(flow.id, { status: "COMPLETED" });
  }
  postResultToCore(done);
  return done;
}

/** After a refresh, in-flight simulated work cannot continue; mark it so the user can retry. */
export function recoverInterruptedWork() {
  const store = useDelegations.getState();
  for (const d of store.delegations) {
    if (["DELEGATED", "QUEUED", "EXECUTING"].includes(d.status)) {
      store.updateDelegation(d.id, { status: "FAILED", error: "Interrupted by page refresh" });
    }
  }
  for (const a of store.subAgents) if (a.status !== "ARCHIVED") store.updateSubAgent(a.id, { status: "ARCHIVED" });
  for (const r of store.runs) if (r.outcome === "running") store.updateRun(r.id, { outcome: "failed", finishedAt: clock.now() });
  for (const f of store.flows) if (f.status === "RUNNING") store.updateFlow(f.id, { status: "FAILED" });
  for (const c of useCompanions.getState().companions)
    if (c.status === "BUSY") useCompanions.getState().update(c.id, { status: "IDLE", currentTask: null });
}
