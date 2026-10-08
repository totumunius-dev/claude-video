import { create } from "zustand";
import type { CompanionId, Id, ThreadId } from "../types/models";

export type View = "world" | "brain" | "companions" | "integrations" | "memory";
export type BrainMode = "folders" | "graph";

export interface Toast {
  id: Id;
  text: string;
  tone: "ok" | "warn" | "error";
}

/** Ephemeral UI state. Not persisted. */
interface UIState {
  view: View;
  brainMode: BrainMode;
  brainFolder: string | null;
  brainCompanion: string | null;
  selectedEntry: Id | null;
  activeThread: ThreadId;
  builderOpen: CompanionId | null;
  gmailAuthOpen: boolean;
  toasts: Toast[];
  setView(v: View): void;
  setBrainMode(m: BrainMode): void;
  openFolder(f: string | null): void;
  setBrainCompanion(c: string | null): void;
  openEntry(id: Id | null): void;
  setThread(t: ThreadId): void;
  openBuilder(id: CompanionId | null): void;
  setGmailAuth(open: boolean): void;
  toast(t: Toast): void;
  dismiss(id: Id): void;
}

export const useUI = create<UIState>()((set) => ({
  view: "world",
  brainMode: "folders",
  brainFolder: null,
  brainCompanion: null,
  selectedEntry: null,
  activeThread: "core",
  builderOpen: null,
  gmailAuthOpen: false,
  toasts: [],
  setView: (view) => set({ view }),
  setBrainMode: (brainMode) => set({ brainMode }),
  openFolder: (brainFolder) => set({ brainFolder }),
  setBrainCompanion: (brainCompanion) => set({ brainCompanion }),
  openEntry: (selectedEntry) => set({ selectedEntry }),
  setThread: (activeThread) => set({ activeThread }),
  openBuilder: (builderOpen) => set({ builderOpen }),
  setGmailAuth: (gmailAuthOpen) => set({ gmailAuthOpen }),
  toast: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
