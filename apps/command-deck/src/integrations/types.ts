import type { IntegrationId } from "../types/models";

export interface ProviderScope {
  id: string;
  label: string;
  description: string;
}

export interface ConnectResult {
  account: string;
  scopes: string[];
  connectedAt: string;
}

export interface ActionResult {
  ok: boolean;
  status: "MOCK_SENT" | "MOCK_DRAFTED" | "SENT" | "FAILED";
  detail: string;
}

/**
 * Contract every integration implements. The mock providers below satisfy it in
 * Preview Mode; a Composio or direct-OAuth provider can replace them later
 * without the conductor or UI changing.
 */
export interface IntegrationProvider {
  id: IntegrationId;
  name: string;
  scopes: ProviderScope[];
  /** Accounts the user can pick from during authorization. */
  listAccounts(): Promise<string[]>;
  connect(account: string, scopes: string[]): Promise<ConnectResult>;
  disconnect(): Promise<void>;
  perform(action: string, payload: Record<string, unknown>): Promise<ActionResult>;
}
