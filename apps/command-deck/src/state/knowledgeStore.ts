import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_KNOWLEDGE } from "../data/seed";
import type { Id, KnowledgeEntry } from "../types/models";
import { clock } from "../core/clock";
import { persistOptions } from "./persist";

interface KnowledgeState {
  entries: KnowledgeEntry[];
  add(e: KnowledgeEntry): void;
  update(id: Id, patch: Partial<KnowledgeEntry>): void;
  link(from: Id, to: Id): void;
  reset(): void;
}

const initial = () => ({ entries: structuredClone(SEED_KNOWLEDGE) });

export const useKnowledge = create<KnowledgeState>()(
  persist(
    (set) => ({
      ...initial(),
      add: (e) => set((s) => ({ entries: [...s.entries.filter((x) => x.id !== e.id), e] })),
      update: (id, patch) =>
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: clock.now() } : e)) })),
      link: (from, to) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === from && !e.linkedEntries.includes(to) ? { ...e, linkedEntries: [...e.linkedEntries, to] } : e,
          ),
        })),
      reset: () => set(initial()),
    }),
    persistOptions<KnowledgeState>("knowledge", (s) => ({ entries: s.entries })),
  ),
);
