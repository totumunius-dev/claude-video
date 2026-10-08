import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

// jsdom has no canvas or matchMedia; the orb only needs them to exist.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
Element.prototype.scrollTo ??= function () {};
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;

describe("Command Deck UI", () => {
  it("renders every panel and answers the team gap question from the chat input", async () => {
    render(<App />);
    for (const label of ["Active Flows", "Agent Roster", "Live Activity and Execution Log", "Chat", "Command Deck"]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByText("KNOWLEDGE VIEW")).toBeTruthy();

    const input = screen.getByLabelText("Message");
    fireEvent.change(input, { target: { value: "What is missing from my team for a product launch?" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(await screen.findByText(/The missing role is customer voice/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create Companion" }));
    expect(screen.getByRole("dialog", { name: "Companion Builder" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm activation" }));
    expect(await screen.findByRole("tab", { name: /COMMUNITY/ })).toBeTruthy();
  });

  it("switches the center view from the dock and keeps chat mounted", () => {
    render(<App />);
    fireEvent.click(screen.getByText("KNOWLEDGE VIEW"));
    expect(screen.getByRole("heading", { name: "Brain" })).toBeTruthy();
    expect(screen.getByLabelText("Chat")).toBeTruthy();
  });
});
