import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentRun, Delegation, DelegationEdge, Flow, Id, SubAgent } from "../types/models";
import { clock } from "../core/clock";
import { persistOptions } from "./persist";

interface DelegationState {
  delegations: Delegation[];
  edges: DelegationEdge[];
  subAgents: SubAgent[];
  runs: AgentRun[];
  flows: Flow[];
  addDelegation(d: Delegation): void;
  updateDelegation(id: Id, patch: Partial<Delegation>): void;
  addEdge(e: DelegationEdge): void;
  addSubAgent(a: SubAgent): void;
  updateSubAgent(id: Id, patch: Partial<SubAgent>): void;
  addRun(r: AgentRun): void;
  updateRun(id: Id, patch: Partial<AgentRun>): void;
  addFlow(f: Flow): void;
  updateFlow(id: Id, patch: Partial<Flow>): void;
  reset(): void;
}

const initial = () => ({
  delegations: [] as Delegation[],
  edges: [] as DelegationEdge[],
  subAgents: [] as SubAgent[],
  runs: [] as AgentRun[],
  flows: [] as Flow[],
});

const patchById = <T extends { id: Id }>(list: T[], id: Id, patch: Partial<T>, stamp = true): T[] =>
  list.map((x) => (x.id === id ? { ...x, ...patch, ...(stamp ? { updatedAt: clock.now() } : {}) } : x));

export const useDelegations = create<DelegationState>()(
  persist(
    (set) => ({
      ...initial(),
      addDelegation: (d) => set((s) => ({ delegations: [...s.delegations, d] })),
      updateDelegation: (id, patch) => set((s) => ({ delegations: patchById(s.delegations, id, patch) })),
      addEdge: (e) => set((s) => ({ edges: [...s.edges, e] })),
      addSubAgent: (a) => set((s) => ({ subAgents: [...s.subAgents, a] })),
      updateSubAgent: (id, patch) => set((s) => ({ subAgents: patchById(s.subAgents, id, patch) })),
      addRun: (r) => set((s) => ({ runs: [...s.runs, r] })),
      updateRun: (id, patch) => set((s) => ({ runs: patchById(s.runs, id, patch, false) })),
      addFlow: (f) => set((s) => ({ flows: [...s.flows, f] })),
      updateFlow: (id, patch) => set((s) => ({ flows: patchById(s.flows, id, patch) })),
      reset: () => set(initial()),
    }),
    persistOptions<DelegationState>("delegations", (s) => ({
      delegations: s.delegations,
      edges: s.edges,
      subAgents: s.subAgents,
      runs: s.runs,
      flows: s.flows,
    })),
  ),
);

export const getDelegation = (id: Id): Delegation | undefined =>
  useDelegations.getState().delegations.find((d) => d.id === id);
