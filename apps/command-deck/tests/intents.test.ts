import { describe, expect, it } from "vitest";
import { parseIntent } from "../src/core/intents";

describe("parseIntent", () => {
  it.each([
    ["What is missing from my team for a product launch?", "team-gap"],
    ["Create that companion.", "create-companion"],
    ["Connect my Gmail.", "connect"],
    ["Email Michael about the launch momentum.", "email"],
    ["Send a dispatch to every companion.", "dispatch"],
    ["Have Marketer ask Scout to research competitors and turn it into campaign ideas.", "chain"],
    ["Remember that launch is Nov 3", "remember"],
    ["hello there", "help"],
  ])("%s -> %s", (text, kind) => {
    expect(parseIntent(text).kind).toBe(kind);
  });

  it("routes Community feedback work to the feedback playbook", () => {
    for (const text of [
      "Send a delegation to Community to create a launch-day customer feedback strategy.",
      "Ask Community to create a launch-day customer feedback strategy.",
    ]) {
      expect(parseIntent(text)).toMatchObject({ kind: "delegate", to: "community", playbook: "feedback-strategy" });
    }
  });

  it("routes Builder roadmap review to the roadmap playbook", () => {
    expect(parseIntent("Ask Builder to review the Community strategy before preparing a roadmap.")).toMatchObject({
      kind: "delegate",
      to: "builder",
      playbook: "roadmap-review",
    });
  });

  it("extracts the email recipient and topic", () => {
    expect(parseIntent("Email Michael about the launch momentum and Community being onboarded.")).toMatchObject({
      kind: "email",
      name: "Michael",
      topic: "the launch momentum and Community being onboarded.",
    });
  });
});
