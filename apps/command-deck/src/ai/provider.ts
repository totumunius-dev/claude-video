import { create } from "zustand";

/** Minimal shape of the claude.ai `sample` capability that this app uses. */
export interface AITool {
  name: string;
  description: string;
  inputSchema?: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
  execute(input: Record<string, unknown>): unknown;
}

export interface AITurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIOptions {
  tools?: AITool[];
  signal?: AbortSignal;
}

/**
 * The model behind Core and the companions. In a claude.ai artifact this is the
 * viewer's own Claude via the `sample` capability; elsewhere it is absent and
 * the app falls back to its keyword router and canned playbooks.
 */
export interface AIProvider {
  label: string;
  supportsTools: boolean;
  chat(turns: AITurn[], opts?: AIOptions): Promise<string>;
  json<T>(prompt: string): Promise<T>;
}

export type AIStatus = "checking" | "ready" | "off" | "denied";

interface AIState {
  status: AIStatus;
  provider: AIProvider | null;
  set(provider: AIProvider | null, status: AIStatus): void;
}

export const useAI = create<AIState>()((set) => ({
  status: "checking",
  provider: null,
  set: (provider, status) => set({ provider, status }),
}));

export const ai = () => {
  const s = useAI.getState();
  return s.status === "ready" ? s.provider : null;
};

/** Error codes that mean "never ask again in this view". */
const PERMANENT = new Set([
  "not_granted",
  "sampling_disabled",
  "not_declared",
  "capability_disabled",
  "capability_removed",
  "tools_unavailable",
]);

export function errorCode(e: unknown): string {
  return typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "upstream_error";
}

/** Turn the provider off for this view if the failure is permanent. */
export function handleAIError(e: unknown): string {
  const code = errorCode(e);
  if (PERMANENT.has(code)) useAI.getState().set(null, "denied");
  return code;
}

type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json<T>(input: unknown, opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ tools?: unknown }>;
};

/** Looks for the claude.ai `sample` capability; resolves quietly to "off" outside an artifact. */
export async function initAI(): Promise<void> {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  if (!claude?.use) {
    useAI.getState().set(null, "off");
    return;
  }
  const sample = (await claude.use("sample").catch(() => null)) as SampleFn | null;
  if (!sample) {
    useAI.getState().set(null, "off");
    return;
  }
  const limits = await sample.limits().catch(() => null);
  useAI.getState().set(
    {
      label: "Claude",
      supportsTools: !!limits?.tools,
      async chat(turns, opts = {}) {
        const { text } = await sample(turns, {
          modelTier: "quick",
          ...(opts.tools ? { tools: opts.tools } : { cache: false }),
          ...(opts.signal ? { signal: opts.signal } : {}),
        });
        return text;
      },
      json: (prompt) => sample.json(prompt, { modelTier: "quick", cache: false }),
    },
    "ready",
  );
}
