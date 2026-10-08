import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ApprovalRequest, Id } from "../types/models";
import { clock } from "../core/clock";
import { persistOptions } from "./persist";

interface ApprovalState {
  approvals: ApprovalRequest[];
  add(a: ApprovalRequest): void;
  update(id: Id, patch: Partial<ApprovalRequest>, action?: string): void;
  reset(): void;
}

export const useApprovals = create<ApprovalState>()(
  persist(
    (set) => ({
      approvals: [],
      add: (a) => set((s) => ({ approvals: [...s.approvals, a] })),
      update: (id, patch, action) =>
        set((s) => ({
          approvals: s.approvals.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...patch,
                  updatedAt: clock.now(),
                  history: action ? [...a.history, { at: clock.now(), action }] : a.history,
                }
              : a,
          ),
        })),
      reset: () => set({ approvals: [] }),
    }),
    persistOptions<ApprovalState>("approvals", (s) => ({ approvals: s.approvals })),
  ),
);
