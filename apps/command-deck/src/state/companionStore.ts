import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_COMPANIONS } from "../data/seed";
import type { Companion, CompanionId } from "../types/models";
import { clock } from "../core/clock";
import { persistOptions } from "./persist";

interface CompanionState {
  companions: Companion[];
  drafts: Companion[];
  add(c: Companion): void;
  update(id: CompanionId, patch: Partial<Companion>): void;
  logActivity(id: CompanionId, text: string): void;
  saveDraft(c: Companion): void;
  removeDraft(id: CompanionId): void;
  reset(): void;
}

const initial = () => ({ companions: structuredClone(SEED_COMPANIONS), drafts: [] as Companion[] });

export const useCompanions = create<CompanionState>()(
  persist(
    (set) => ({
      ...initial(),
      add: (c) => set((s) => ({ companions: [...s.companions.filter((x) => x.id !== c.id), c] })),
      update: (id, patch) =>
        set((s) => ({
          companions: s.companions.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: clock.now() } : c)),
        })),
      logActivity: (id, text) =>
        set((s) => ({
          companions: s.companions.map((c) =>
            c.id === id ? { ...c, recentActivity: [{ at: clock.now(), text }, ...c.recentActivity].slice(0, 12) } : c,
          ),
        })),
      saveDraft: (c) => set((s) => ({ drafts: [...s.drafts.filter((d) => d.id !== c.id), c] })),
      removeDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
      reset: () => set(initial()),
    }),
    persistOptions<CompanionState>("companions", (s) => ({ companions: s.companions, drafts: s.drafts })),
  ),
);

export const getCompanion = (id: string): Companion | undefined =>
  useCompanions.getState().companions.find((c) => c.id === id);
