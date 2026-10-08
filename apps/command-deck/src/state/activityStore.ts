import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActivityEvent, LogEntry } from "../types/models";
import { persistOptions } from "./persist";

interface ActivityState {
  events: ActivityEvent[];
  log: LogEntry[];
  addEvent(e: ActivityEvent): void;
  addLog(l: LogEntry): void;
  reset(): void;
}

export const useActivity = create<ActivityState>()(
  persist(
    (set) => ({
      events: [],
      log: [],
      addEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 200) })),
      addLog: (l) => set((s) => ({ log: [l, ...s.log].slice(0, 400) })),
      reset: () => set({ events: [], log: [] }),
    }),
    persistOptions<ActivityState>("activity", (s) => ({ events: s.events, log: s.log })),
  ),
);
