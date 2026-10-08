import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, ThreadId, VoiceState } from "../types/models";
import { persistOptions } from "./persist";

interface ConversationState {
  messages: ChatMessage[];
  voice: VoiceState;
  pending: Record<string, boolean>; // thread -> Core/companion is composing
  add(m: ChatMessage): void;
  setVoice(v: VoiceState): void;
  setPending(thread: ThreadId, on: boolean): void;
  reset(): void;
}

export const useConversation = create<ConversationState>()(
  persist(
    (set) => ({
      messages: [],
      voice: "idle",
      pending: {},
      add: (m) => set((s) => ({ messages: [...s.messages, m] })),
      setVoice: (voice) => set({ voice }),
      setPending: (thread, on) => set((s) => ({ pending: { ...s.pending, [thread]: on } })),
      reset: () => set({ messages: [], voice: "idle", pending: {} }),
    }),
    persistOptions<ConversationState>("conversation", (s) => ({ messages: s.messages })),
  ),
);
