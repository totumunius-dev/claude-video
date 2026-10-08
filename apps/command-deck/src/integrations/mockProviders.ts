import { MOCK_ACCOUNTS } from "../data/seed";
import { clock } from "../core/clock";
import type { IntegrationId } from "../types/models";
import type { IntegrationProvider, ProviderScope } from "./types";

export const GMAIL_SCOPES: ProviderScope[] = [
  { id: "gmail.read", label: "Read email", description: "View your messages and threads" },
  { id: "gmail.compose", label: "Draft email", description: "Create drafts in your mailbox" },
  { id: "gmail.send", label: "Send email", description: "Send email on your behalf after you approve" },
];

function mockProvider(id: IntegrationId, name: string, scopes: ProviderScope[]): IntegrationProvider {
  return {
    id,
    name,
    scopes,
    async listAccounts() {
      return MOCK_ACCOUNTS;
    },
    async connect(account, granted) {
      await clock.sleep(600);
      return { account, scopes: granted, connectedAt: clock.now() };
    },
    async disconnect() {
      await clock.sleep(100);
    },
    async perform(action) {
      await clock.sleep(700);
      // Preview Mode never reaches a real service.
      if (action === "send_email") return { ok: true, status: "MOCK_SENT", detail: "Preview Mode: not delivered" };
      return { ok: true, status: "MOCK_DRAFTED", detail: `Preview Mode: ${action} simulated` };
    },
  };
}

export const providers: Record<IntegrationId, IntegrationProvider> = {
  gmail: mockProvider("gmail", "Gmail", GMAIL_SCOPES),
  slack: mockProvider("slack", "Slack", [{ id: "slack.post", label: "Post messages", description: "Post to channels" }]),
  shopify: mockProvider("shopify", "Shopify", [{ id: "shopify.read", label: "Read orders", description: "View orders and products" }]),
  calendar: mockProvider("calendar", "Google Calendar", [{ id: "calendar.read", label: "Read events", description: "View your calendar" }]),
};
