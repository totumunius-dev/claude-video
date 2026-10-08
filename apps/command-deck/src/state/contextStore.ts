import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_MEMORY, WORKSPACE_GOAL } from "../data/seed";
import type { Id, MemoryItem } from "../types/models";
import { clock } from "../core/clock";
import { persistOptions } from "./persist";

interface ContextState {
  workspaceGoal: string;
  memory: MemoryItem[];
  setGoal(goal: string): void;
  addMemory(m: MemoryItem): void;
  editMemory(id: Id, text: string): void;
  forgetMemory(id: Id): void;
  reset(): void;
}

const initial = () => ({ workspaceGoal: WORKSPACE_GOAL, memory: structuredClone(SEED_MEMORY) });

export const useContext = create<ContextState>()(
  persist(
    (set) => ({
      ...initial(),
      setGoal: (workspaceGoal) =>
        set((s) => ({
          workspaceGoal,
          memory: s.memory.map((m) => (m.kind === "goal" ? { ...m, text: workspaceGoal, updatedAt: clock.now() } : m)),
        })),
      addMemory: (m) => set((s) => ({ memory: [...s.memory, m] })),
      editMemory: (id, text) =>
        set((s) => ({
          memory: s.memory.map((m) => (m.id === id ? { ...m, text, updatedAt: clock.now() } : m)),
          ...(s.memory.find((m) => m.id === id)?.kind === "goal" ? { workspaceGoal: text } : {}),
        })),
      forgetMemory: (id) => set((s) => ({ memory: s.memory.filter((m) => m.id !== id) })),
      reset: () => set(initial()),
    }),
    persistOptions<ContextState>("context", (s) => ({ workspaceGoal: s.workspaceGoal, memory: s.memory })),
  ),
);
