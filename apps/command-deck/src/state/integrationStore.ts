import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_INTEGRATIONS } from "../data/seed";
import type { IntegrationId, IntegrationState } from "../types/models";
import { persistOptions } from "./persist";

interface IntegrationSlice {
  integrations: IntegrationState[];
  update(id: IntegrationId, patch: Partial<IntegrationState>): void;
  reset(): void;
}

const initial = () => ({ integrations: structuredClone(SEED_INTEGRATIONS) });

export const useIntegrations = create<IntegrationSlice>()(
  persist(
    (set) => ({
      ...initial(),
      update: (id, patch) =>
        set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      reset: () => set(initial()),
    }),
    persistOptions<IntegrationSlice>("integrations", (s) => ({ integrations: s.integrations })),
  ),
);

export const getIntegration = (id: IntegrationId) =>
  useIntegrations.getState().integrations.find((i) => i.id === id)!;
